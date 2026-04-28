"""Tests for src.policies.perfect_foresight_lp."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.policies.perfect_foresight_lp import solve_perfect_foresight
from src.utils.config import BatteryParams


def _idx(n: int) -> pd.DatetimeIndex:
    return pd.date_range("2024-06-01", periods=n, freq="1h", tz="UTC")


def test_two_period_charges_then_discharges() -> None:
    """With LMP=[20, 80], the battery should charge in t=0 and discharge in t=1."""
    idx = _idx(2)
    lmps = pd.Series([20.0, 80.0], index=idx, name="lmp")
    zero = pd.Series([0.0, 0.0], index=idx)
    bp = BatteryParams(
        E_max=10.0, P_max=5.0, eta_c=1.0, eta_d=1.0, kappa=0.0, E_initial=0.0, rho_assumed=0.95
    )
    res = solve_perfect_foresight(lmps, zero, zero, battery=bp, dt_hours=1.0)

    assert res.schedule["c_mw"].iloc[0] > 4.99   # at the cap
    assert res.schedule["d_mw"].iloc[0] < 1e-6
    assert res.schedule["d_mw"].iloc[1] > 4.99
    assert res.schedule["c_mw"].iloc[1] < 1e-6
    # Revenue: charge 5 MW * 1h * $20 = -$100, discharge 5 * $80 = $400 -> $300
    assert res.total_revenue == pytest.approx(300.0, abs=1e-3)


def test_flat_lmp_zero_revenue() -> None:
    """With flat LMP, no reg market, and an empty battery, optimal is to do nothing."""
    idx = _idx(24)
    lmps = pd.Series(np.full(24, 30.0), index=idx, name="lmp")
    zero = pd.Series(np.zeros(24), index=idx)
    bp = BatteryParams(
        E_max=20.0, P_max=10.0, eta_c=0.95, eta_d=0.95, kappa=2.0, E_initial=0.0,
        rho_assumed=0.95,
    )
    res = solve_perfect_foresight(lmps, zero, zero, battery=bp, dt_hours=1.0)

    assert res.total_revenue == pytest.approx(0.0, abs=1e-6)
    assert res.schedule["c_mw"].max() < 1e-6
    assert res.schedule["d_mw"].max() < 1e-6


def test_zero_lmp_variation_positive_reg_maxes_bid() -> None:
    """If LMP is flat but reg_cap > 0, the optimum is to bid full headroom into reg."""
    idx = _idx(4)
    lmps = pd.Series(np.full(4, 30.0), index=idx, name="lmp")
    reg_cap = pd.Series(np.full(4, 10.0), index=idx)
    reg_perf = pd.Series(np.zeros(4), index=idx)
    # kappa>0 + E_initial=0 makes (c=d=0, b_reg=P_max) the *unique* optimum.
    bp = BatteryParams(
        E_max=10.0, P_max=5.0, eta_c=1.0, eta_d=1.0, kappa=2.0, E_initial=0.0,
        rho_assumed=0.95,
    )
    res = solve_perfect_foresight(lmps, reg_cap, reg_perf, battery=bp, dt_hours=1.0)
    # Should bid the full P_max into reg every hour
    np.testing.assert_allclose(res.schedule["b_reg_mw"].to_numpy(), 5.0, atol=1e-6)
    np.testing.assert_allclose(res.schedule["c_mw"].to_numpy(), 0.0, atol=1e-6)
    np.testing.assert_allclose(res.schedule["d_mw"].to_numpy(), 0.0, atol=1e-6)
    # Revenue: 5 MW * $10 * 4 h = $200
    assert res.total_revenue == pytest.approx(200.0, abs=1e-3)


def test_no_simultaneous_charge_and_discharge_with_kappa() -> None:
    """With non-zero kappa, c and d should never both be positive."""
    idx = _idx(12)
    rng = np.random.default_rng(0)
    lmps = pd.Series(20 + 30 * rng.random(12), index=idx, name="lmp")
    zero = pd.Series(np.zeros(12), index=idx)
    bp = BatteryParams(
        E_max=10.0, P_max=5.0, eta_c=0.92, eta_d=0.92, kappa=2.0, E_initial=5.0,
        rho_assumed=0.95,
    )
    res = solve_perfect_foresight(lmps, zero, zero, battery=bp, dt_hours=1.0)
    assert (res.schedule["c_mw"] * res.schedule["d_mw"] < 1e-4).all()


def test_index_mismatch_raises() -> None:
    idx = _idx(3)
    lmps = pd.Series([20, 30, 40], index=idx, dtype=float)
    bad_idx = idx.shift(periods=1, freq="1h")
    bad_reg = pd.Series([0.0, 0.0, 0.0], index=bad_idx)
    with pytest.raises(ValueError, match="share an index"):
        solve_perfect_foresight(lmps, bad_reg, bad_reg, dt_hours=1.0)


def test_returns_dispatch_result_shape() -> None:
    idx = _idx(6)
    lmps = pd.Series([20, 25, 30, 80, 70, 30], index=idx, dtype=float, name="lmp")
    zero = pd.Series(np.zeros(6), index=idx)
    res = solve_perfect_foresight(lmps, zero, zero, dt_hours=1.0)
    assert len(res.schedule) == 6
    assert res.policy_name == "perfect_foresight_lp"
    assert res.solve_time_seconds >= 0
