"""Tests for src.forecasting.xgboost_forecaster."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.forecasting.xgboost_forecaster import (
    NaivePersistenceForecaster,
    PerfectForecaster,
    XGBoostLMPForecaster,
    _featurize,
)


def _ar1_series(n: int = 2_000, phi: float = 0.6, seed: int = 0) -> pd.Series:
    rng = np.random.default_rng(seed)
    eps = rng.normal(0.0, 1.0, size=n)
    x = np.zeros(n)
    for t in range(1, n):
        x[t] = phi * x[t - 1] + eps[t]
    x = 30.0 + 5.0 * x  # make it look like prices
    idx = pd.date_range("2024-06-01", periods=n, freq="5min", tz="UTC")
    return pd.Series(x, index=idx, name="lmp")


def test_featurize_shapes() -> None:
    s = _ar1_series(n=200)
    X, y, idx = _featurize(s)
    assert X.shape == (200 - 12, 12 + 2 + 7)
    assert y.shape == (200 - 12,)
    assert len(idx) == 200 - 12


def test_xgboost_beats_naive_on_ar1() -> None:
    """On AR(1) with phi=0.6, XGBoost should beat persistence on test RMSE."""
    s = _ar1_series(n=4_000, phi=0.6, seed=42)
    n_train = int(0.8 * len(s))

    fc = XGBoostLMPForecaster(n_estimators=100, max_depth=4, learning_rate=0.1)
    metrics = fc.fit(s, test_fraction=0.2)

    # Naive baseline: predict y[t-1] for y[t]; compute RMSE on the same test slice
    y_test = s.to_numpy(dtype=float)[n_train + 12:]
    y_test_lag1 = s.to_numpy(dtype=float)[n_train + 12 - 1 : -1]
    naive_rmse = float(np.sqrt(np.mean((y_test - y_test_lag1) ** 2)))

    assert metrics.rmse_test < naive_rmse


def test_predict_horizon_shape_and_index() -> None:
    s = _ar1_series(n=600)
    fc = XGBoostLMPForecaster(n_estimators=50, max_depth=3)
    fc.fit(s)
    out = fc.predict_horizon(s.iloc[:300], horizon_steps=24)
    assert len(out) == 24
    assert out.index.tz is not None
    # First forecast timestamp should be exactly 5 min after the history's last
    assert out.index[0] == s.index[300 - 1] + pd.Timedelta("5min")


def test_predict_horizon_requires_fitted_model() -> None:
    s = _ar1_series(n=300)
    fc = XGBoostLMPForecaster()
    with pytest.raises(RuntimeError, match="fit"):
        fc.predict_horizon(s, horizon_steps=12)


def test_naive_persistence_returns_constant() -> None:
    s = _ar1_series(n=100)
    fc = NaivePersistenceForecaster()
    out = fc.predict_horizon(s, horizon_steps=10)
    assert (out == s.iloc[-1]).all()
    assert len(out) == 10


def test_perfect_forecaster_returns_truth() -> None:
    s = _ar1_series(n=100)
    pf = PerfectForecaster(s)
    out = pf.predict_horizon(s.iloc[:50], horizon_steps=10)
    pd.testing.assert_series_equal(
        out.rename("lmp"), s.iloc[50:60].rename("lmp"), check_names=True, check_freq=False,
    )
