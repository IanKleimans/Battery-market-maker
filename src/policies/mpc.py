"""Model-predictive control battery dispatch policy.

At each settlement interval ``t``:

1. Use the LMP forecaster to produce ``horizon_steps`` future LMP estimates
   conditional on the realised history up to and including ``t-1``.
2. Solve a deterministic finite-horizon LP (the same builder used by the
   perfect-foresight policy) over those forecasted LMPs starting from the
   *current* SOC.
3. Implement the first interval's action ``(c_t, d_t, b_reg_t)``.
4. Step the SOC forward using the *realised* LMP and the realised reg prices
   (which we observe; only LMPs are forecasted in this report).

For computational efficiency we re-build a fresh cvxpy problem at each step.
On a 1-week 5-min dataset (2016 steps) with horizon=288 this is the dominant
cost; we therefore use a smaller default horizon for benchmarking.

The forecaster only forecasts LMPs.  Regulation prices are taken from the
realised series (a common assumption in PJM studies because reg cap clears
hourly day-ahead with very low forecast error compared to RT energy).
"""

from __future__ import annotations

import time
from typing import Protocol

import numpy as np
import pandas as pd

from src.policies.perfect_foresight_lp import _LpInputs, _build_problem, _solve
from src.policies.types import DispatchResult
from src.utils.config import DEFAULT_BATTERY, BatteryParams


class _Forecaster(Protocol):
    """Minimal interface MPC needs."""

    @property
    def lag(self) -> int: ...
    def predict_horizon(
        self,
        history: pd.Series,
        horizon_steps: int,
        freq: pd.Timedelta = pd.Timedelta("5min"),
    ) -> pd.Series: ...


def solve_mpc(
    lmps: pd.Series,
    reg_cap_prices: pd.Series,
    reg_perf_prices: pd.Series,
    forecaster: _Forecaster,
    horizon_steps: int = 288,
    battery: BatteryParams = DEFAULT_BATTERY,
    dt_hours: float = 5.0 / 60.0,
    rho_assumed: float = 0.95,
    history_seed: pd.Series | None = None,
    policy_name: str | None = None,
    resolve_every: int = 1,
) -> DispatchResult:
    """Run an MPC dispatch over the realised LMP series.

    Parameters
    ----------
    lmps, reg_cap_prices, reg_perf_prices
        Tz-aware UTC series sharing the same index — these are the *realised*
        prices used to roll the simulation.
    forecaster
        Object with ``predict_horizon(history, horizon_steps)`` returning a
        future LMP series.  See :mod:`src.forecasting.xgboost_forecaster`.
    horizon_steps
        Number of intervals in the LP look-ahead.
    battery, dt_hours, rho_assumed
        As in :func:`solve_perfect_foresight`.
    history_seed
        Optional priming history of LMPs *before* ``lmps`` so that the very
        first MPC step has enough lag context.  If ``None``, the first
        ``forecaster.lag`` steps re-use the initial values of ``lmps`` itself.
    policy_name
        Override for the result label (default ``mpc_<forecaster_class>``).
    resolve_every
        Re-solve only every N steps; in between, replay the previously planned
        actions.  Useful for cutting solve time on long horizons.
    """
    if lmps.index.tz is None:
        raise ValueError("lmps must be tz-aware")
    if not lmps.index.equals(reg_cap_prices.index):
        raise ValueError("lmps and reg_cap_prices must share an index")
    if not lmps.index.equals(reg_perf_prices.index):
        raise ValueError("lmps and reg_perf_prices must share an index")
    if horizon_steps < 1:
        raise ValueError(f"horizon_steps must be >= 1, got {horizon_steps}")
    if resolve_every < 1:
        raise ValueError(f"resolve_every must be >= 1, got {resolve_every}")

    T = len(lmps)
    lmp_arr = np.asarray(lmps.to_numpy(), dtype=float)
    reg_cap_arr = np.asarray(reg_cap_prices.to_numpy(), dtype=float)
    reg_perf_arr = np.asarray(reg_perf_prices.to_numpy(), dtype=float)

    # Seed history (used by the forecaster). It must be tz-aware UTC.
    if history_seed is not None:
        if history_seed.index.tz is None:
            raise ValueError("history_seed must be tz-aware")
        running_history = history_seed.copy()
    else:
        running_history = pd.Series(dtype=float, index=pd.DatetimeIndex([], tz="UTC"))

    c_out = np.zeros(T)
    d_out = np.zeros(T)
    b_out = np.zeros(T)
    E_out = np.zeros(T)

    E = float(battery.E_initial)
    cached_plan: tuple[np.ndarray, np.ndarray, np.ndarray] | None = None
    cached_pos = 0

    t0 = time.perf_counter()
    for t in range(T):
        # Decide whether we need to (re)solve.
        need_resolve = (cached_plan is None) or (cached_pos >= resolve_every) or (cached_pos >= len(cached_plan[0]))
        if need_resolve:
            # Build the history up to and including t-1
            if t == 0 and history_seed is None:
                # Seed with the first available LMP so the forecaster has lag context
                seed_len = max(forecaster.lag, 1)
                seed_idx = pd.date_range(
                    end=lmps.index[0] - pd.Timedelta("5min"),
                    periods=seed_len, freq="5min", tz="UTC",
                )
                seed = pd.Series(np.full(seed_len, lmp_arr[0]), index=seed_idx)
                history_for_forecast = seed
            else:
                full_hist = pd.concat([running_history, lmps.iloc[:t]])
                history_for_forecast = full_hist if len(full_hist) >= forecaster.lag else _pad(full_hist, forecaster.lag)

            steps_left = T - t
            h = min(horizon_steps, steps_left)
            forecast = forecaster.predict_horizon(history_for_forecast, horizon_steps=h)

            # Use realised reg prices over the same window (assumed observable)
            inputs = _LpInputs(
                lmp=forecast.to_numpy(dtype=float),
                reg_cap=reg_cap_arr[t : t + h],
                reg_perf=reg_perf_arr[t : t + h],
                dt_hours=dt_hours,
                rho=rho_assumed,
            )
            problem, vars_ = _build_problem(inputs, battery, E_initial=E)
            _solve(problem)

            cached_plan = (
                np.asarray(vars_["c"].value, dtype=float),
                np.asarray(vars_["d"].value, dtype=float),
                np.asarray(vars_["b_reg"].value, dtype=float),
            )
            cached_pos = 0

        c_t = float(cached_plan[0][cached_pos])
        d_t = float(cached_plan[1][cached_pos])
        b_t = float(cached_plan[2][cached_pos])
        cached_pos += 1

        # Apply transition with realised LMP — no model error in dynamics
        E = E + battery.eta_c * c_t * dt_hours - d_t * dt_hours / battery.eta_d
        E = float(np.clip(E, 0.0, battery.E_max))

        c_out[t] = c_t
        d_out[t] = d_t
        b_out[t] = b_t
        E_out[t] = E

    elapsed = time.perf_counter() - t0

    energy_reward = lmp_arr * (d_out - c_out) * dt_hours
    reg_reward = (
        reg_cap_arr * b_out * dt_hours + reg_perf_arr * rho_assumed * b_out * dt_hours
    )
    deg = battery.kappa * (c_out + d_out) * dt_hours
    reward = energy_reward + reg_reward - deg

    schedule = pd.DataFrame(
        {
            "c_mw": c_out,
            "d_mw": d_out,
            "b_reg_mw": b_out,
            "E_mwh": E_out,
            "lmp": lmp_arr,
            "reward": reward,
        },
        index=lmps.index,
    )

    name = policy_name or f"mpc_{type(forecaster).__name__}_h{horizon_steps}"
    return DispatchResult(
        schedule=schedule,
        total_revenue=float(reward.sum()),
        energy_revenue=float(energy_reward.sum()),
        regulation_revenue=float(reg_reward.sum()),
        degradation_cost=float(deg.sum()),
        solve_time_seconds=elapsed,
        policy_name=name,
    )


def _pad(history: pd.Series, min_len: int) -> pd.Series:
    """Left-pad ``history`` with its first observation to reach ``min_len``."""
    if len(history) >= min_len:
        return history
    pad_n = min_len - len(history)
    if len(history) == 0:
        raise ValueError("Cannot pad empty history")
    pad_idx = pd.date_range(
        end=history.index[0] - pd.Timedelta("5min"),
        periods=pad_n, freq="5min", tz=history.index.tz,
    )
    pad = pd.Series(np.full(pad_n, float(history.iloc[0])), index=pad_idx)
    return pd.concat([pad, history])
