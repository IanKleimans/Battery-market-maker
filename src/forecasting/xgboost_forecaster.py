"""XGBoost LMP forecaster used by the MPC policy.

Features
--------
* Last 12 LMP values (lag features)
* Hour-of-day sine and cosine
* Day-of-week one-hot (7 dummies)

Targets
-------
The single next interval's LMP.  Multi-step ahead forecasting is performed by
*iterative prediction*: the previous step's prediction is fed into the lag
window for the next step.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import xgboost as xgb

_LAG = 12


@dataclass
class TrainTestMetrics:
    rmse_train: float
    rmse_test: float
    mape_test: float
    n_train: int
    n_test: int


def _hour_sincos(idx: pd.DatetimeIndex) -> tuple[np.ndarray, np.ndarray]:
    et = idx.tz_convert("America/New_York") if idx.tz is not None else idx
    hour_frac = np.asarray(et.hour, dtype=float) + np.asarray(et.minute, dtype=float) / 60.0
    angle = 2 * np.pi * hour_frac / 24.0
    return np.sin(angle), np.cos(angle)


def _dow_one_hot(idx: pd.DatetimeIndex) -> np.ndarray:
    dow = np.asarray(idx.dayofweek if idx.tz is None else idx.tz_convert("America/New_York").dayofweek)
    onehot = np.zeros((len(idx), 7), dtype=float)
    onehot[np.arange(len(idx)), dow] = 1.0
    return onehot


def _featurize(lmps: pd.Series) -> tuple[np.ndarray, np.ndarray, pd.DatetimeIndex]:
    """Build the design matrix and target vector for training.

    Returns
    -------
    X
        Shape (n - LAG, 12 + 2 + 7).
    y
        Shape (n - LAG,) — value at index t for t in [LAG, n).
    aligned_index
        Tz-aware index of length (n - LAG).
    """
    if lmps.index.tz is None:
        raise ValueError("lmps must be tz-aware")
    if len(lmps) <= _LAG + 1:
        raise ValueError(f"Need >{_LAG + 1} observations; got {len(lmps)}")

    arr = lmps.to_numpy(dtype=float)
    n = len(arr)
    n_rows = n - _LAG

    # Lag matrix: row i contains lmp[i], lmp[i+1], ..., lmp[i+LAG-1] (last LAG values
    # *before* the target at position i + LAG).
    lag_mat = np.empty((n_rows, _LAG), dtype=float)
    for k in range(_LAG):
        lag_mat[:, k] = arr[k : k + n_rows]

    aligned_index = lmps.index[_LAG:]
    sin, cos = _hour_sincos(aligned_index)
    dow = _dow_one_hot(aligned_index)

    X = np.concatenate([lag_mat, sin[:, None], cos[:, None], dow], axis=1)
    y = arr[_LAG:]
    return X, y, aligned_index


class XGBoostLMPForecaster:
    """Iterative-prediction XGBoost forecaster.

    Hyperparameters chosen as small/fast defaults suitable for the report's
    benchmark; not tuned exhaustively.
    """

    def __init__(
        self,
        n_estimators: int = 200,
        max_depth: int = 5,
        learning_rate: float = 0.08,
        subsample: float = 0.9,
        random_state: int = 42,
    ) -> None:
        self._params = dict(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=subsample,
            random_state=random_state,
            tree_method="hist",
            objective="reg:squarederror",
        )
        self.model: xgb.XGBRegressor | None = None
        self.metrics: TrainTestMetrics | None = None

    @property
    def lag(self) -> int:
        return _LAG

    def fit(self, lmps: pd.Series, test_fraction: float = 0.2) -> TrainTestMetrics:
        """Fit on a tz-aware LMP series with an 80/20 chronological split."""
        if not (0.0 < test_fraction < 1.0):
            raise ValueError("test_fraction must be in (0, 1)")
        X, y, _ = _featurize(lmps)
        n = len(y)
        n_train = max(1, int(n * (1 - test_fraction)))

        X_tr, X_te = X[:n_train], X[n_train:]
        y_tr, y_te = y[:n_train], y[n_train:]

        self.model = xgb.XGBRegressor(**self._params)
        self.model.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)

        rmse_tr = float(np.sqrt(np.mean((self.model.predict(X_tr) - y_tr) ** 2)))
        if len(y_te) > 0:
            pred_te = self.model.predict(X_te)
            rmse_te = float(np.sqrt(np.mean((pred_te - y_te) ** 2)))
            denom = np.where(np.abs(y_te) > 1e-3, np.abs(y_te), 1e-3)
            mape_te = float(np.mean(np.abs((pred_te - y_te) / denom)))
        else:
            rmse_te = float("nan")
            mape_te = float("nan")

        self.metrics = TrainTestMetrics(
            rmse_train=rmse_tr,
            rmse_test=rmse_te,
            mape_test=mape_te,
            n_train=int(n_train),
            n_test=int(n - n_train),
        )
        return self.metrics

    def _features_at(
        self,
        history_window: np.ndarray,
        target_ts: pd.Timestamp,
    ) -> np.ndarray:
        """Build a single feature row for a target timestamp."""
        sin, cos = _hour_sincos(pd.DatetimeIndex([target_ts]))
        dow = _dow_one_hot(pd.DatetimeIndex([target_ts]))
        feat = np.concatenate([history_window, sin, cos, dow.flatten()])
        return feat[None, :]

    def predict_horizon(
        self,
        history: pd.Series,
        horizon_steps: int,
        freq: pd.Timedelta = pd.Timedelta("5min"),
    ) -> pd.Series:
        """Iteratively predict ``horizon_steps`` future LMPs.

        Parameters
        ----------
        history
            Tz-aware LMP series ending immediately before the forecast window.
            The last ``LAG`` values are used as the seed lag window.
        horizon_steps
            Number of future intervals to predict.
        freq
            Settlement-interval spacing.
        """
        if self.model is None:
            raise RuntimeError("Forecaster must be fit() before predict_horizon().")
        if len(history) < _LAG:
            raise ValueError(f"history must have at least {_LAG} observations")
        if history.index.tz is None:
            raise ValueError("history must be tz-aware")

        last_ts = history.index[-1]
        future_idx = pd.date_range(
            start=last_ts + freq, periods=horizon_steps, freq=freq, tz=history.index.tz
        )

        window = history.to_numpy(dtype=float)[-_LAG:].copy()
        preds = np.zeros(horizon_steps, dtype=float)
        for step in range(horizon_steps):
            feat = self._features_at(window, future_idx[step])
            yhat = float(self.model.predict(feat)[0])
            preds[step] = yhat
            # Slide the window forward
            window = np.concatenate([window[1:], [yhat]])
        return pd.Series(preds, index=future_idx, name="lmp_forecast")


class NaivePersistenceForecaster:
    """Trivial baseline: predicts the last observed value forever."""

    @property
    def lag(self) -> int:
        return 1

    def fit(self, lmps: pd.Series, test_fraction: float = 0.2) -> TrainTestMetrics:
        return TrainTestMetrics(
            rmse_train=0.0,
            rmse_test=float("nan"),
            mape_test=float("nan"),
            n_train=len(lmps),
            n_test=0,
        )

    def predict_horizon(
        self,
        history: pd.Series,
        horizon_steps: int,
        freq: pd.Timedelta = pd.Timedelta("5min"),
    ) -> pd.Series:
        last = float(history.iloc[-1])
        future_idx = pd.date_range(
            start=history.index[-1] + freq, periods=horizon_steps, freq=freq, tz=history.index.tz
        )
        return pd.Series(np.full(horizon_steps, last), index=future_idx, name="lmp_forecast")


class PerfectForecaster:
    """Cheat baseline: returns the realised future series.

    Used to verify MPC matches PF-LP under a perfect oracle.
    """

    def __init__(self, full_series: pd.Series) -> None:
        if full_series.index.tz is None:
            raise ValueError("full_series must be tz-aware")
        self._series = full_series

    @property
    def lag(self) -> int:
        return 0

    def fit(self, lmps: pd.Series, test_fraction: float = 0.2) -> TrainTestMetrics:
        return TrainTestMetrics(
            rmse_train=0.0,
            rmse_test=0.0,
            mape_test=0.0,
            n_train=len(lmps),
            n_test=0,
        )

    def predict_horizon(
        self,
        history: pd.Series,
        horizon_steps: int,
        freq: pd.Timedelta = pd.Timedelta("5min"),
    ) -> pd.Series:
        last_ts = history.index[-1]
        future_idx = pd.date_range(
            start=last_ts + freq, periods=horizon_steps, freq=freq, tz=history.index.tz
        )
        # Truncate to whatever is available
        out = self._series.reindex(future_idx)
        if out.isna().any():
            # Fall back to last observed for tail
            out = out.ffill().bfill()
        return out.rename("lmp_forecast")
