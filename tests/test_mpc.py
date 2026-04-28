"""Tests for src.policies.mpc."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.forecasting.xgboost_forecaster import (
    NaivePersistenceForecaster,
    PerfectForecaster,
)
from src.policies.mpc import solve_mpc
from src.policies.myopic_greedy import solve_myopic_greedy
from src.policies.perfect_foresight_lp import solve_perfect_foresight
from src.utils.config import BatteryParams
from src.utils.synthetic_data import (
    generate_synthetic_lmps,
    generate_synthetic_reg_prices,
)


def test_mpc_with_perfect_forecaster_matches_pf_lp() -> None:
    """With a PerfectForecaster and horizon=T, MPC = PF-LP exactly."""
    lmps = generate_synthetic_lmps(n_days=2, seed=99)
    reg = generate_synthetic_reg_prices(lmps, seed=99)
    bp = BatteryParams()

    pf = solve_perfect_foresight(
        lmps, reg["reg_cap_price"], reg["reg_perf_price"], battery=bp
    )

    forecaster = PerfectForecaster(lmps)
    # Use a horizon long enough to see the full window from any starting point
    mpc = solve_mpc(
        lmps,
        reg["reg_cap_price"],
        reg["reg_perf_price"],
        forecaster=forecaster,
        horizon_steps=len(lmps),
        battery=bp,
        resolve_every=len(lmps),  # solve once
    )

    # Within 1 % per spec
    rel_gap = abs(mpc.total_revenue - pf.total_revenue) / max(abs(pf.total_revenue), 1.0)
    assert rel_gap < 0.01, f"MPC vs PF-LP gap too large: {rel_gap*100:.2f}%"


def test_mpc_horizon_one_matches_myopic() -> None:
    """MPC with horizon=1 sees only the current interval ⇒ identical to myopic.

    Spec test (b): a forecaster whose horizon collapses to one step makes MPC
    degenerate to the myopic-greedy policy.  Any forecaster works because only
    the t=0 prediction is consumed; we re-use the *realised* LMP as that t=0.
    """
    lmps = generate_synthetic_lmps(n_days=1, seed=23)
    reg = generate_synthetic_reg_prices(lmps, seed=23)
    bp = BatteryParams()

    my = solve_myopic_greedy(
        lmps, reg["reg_cap_price"], reg["reg_perf_price"], battery=bp
    )

    fc = PerfectForecaster(lmps)  # truth at t=0 → MPC == myopic
    mpc = solve_mpc(
        lmps,
        reg["reg_cap_price"],
        reg["reg_perf_price"],
        forecaster=fc,
        horizon_steps=1,
        battery=bp,
        resolve_every=1,
    )
    assert abs(mpc.total_revenue - my.total_revenue) < 1e-3


def test_mpc_horizon_grows_revenue_monotonically_under_perfect_foresight() -> None:
    """Longer horizons with a PerfectForecaster never decrease revenue."""
    lmps = generate_synthetic_lmps(n_days=1, seed=31)
    reg = generate_synthetic_reg_prices(lmps, seed=31)
    bp = BatteryParams()
    fc = PerfectForecaster(lmps)

    revenues = []
    for h in (1, 12, 96):
        mpc = solve_mpc(
            lmps, reg["reg_cap_price"], reg["reg_perf_price"],
            forecaster=fc, horizon_steps=h, battery=bp, resolve_every=h,
        )
        revenues.append(mpc.total_revenue)

    # Allow tiny numerical noise but require non-decreasing
    for prev, nxt in zip(revenues, revenues[1:]):
        assert nxt >= prev - 1e-3, f"Revenue dropped: {revenues}"


def test_mpc_index_mismatch_raises() -> None:
    idx = pd.date_range("2024-06-01", periods=4, freq="5min", tz="UTC")
    lmps = pd.Series([20, 25, 30, 35], index=idx, dtype=float)
    bad_idx = idx + pd.Timedelta("5min")
    bad_reg = pd.Series([0.0, 0.0, 0.0, 0.0], index=bad_idx)
    with pytest.raises(ValueError, match="share an index"):
        solve_mpc(lmps, bad_reg, bad_reg, forecaster=NaivePersistenceForecaster(),
                  horizon_steps=2)


def test_mpc_invalid_horizon_raises() -> None:
    idx = pd.date_range("2024-06-01", periods=4, freq="5min", tz="UTC")
    lmps = pd.Series([20, 25, 30, 35], index=idx, dtype=float)
    zero = pd.Series(np.zeros(4), index=idx)
    with pytest.raises(ValueError, match="horizon_steps"):
        solve_mpc(lmps, zero, zero, forecaster=NaivePersistenceForecaster(), horizon_steps=0)
