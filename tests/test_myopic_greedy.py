"""Tests for src.policies.myopic_greedy."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.policies.myopic_greedy import solve_myopic_greedy
from src.policies.perfect_foresight_lp import solve_perfect_foresight
from src.utils.config import BatteryParams
from src.utils.synthetic_data import (
    generate_synthetic_lmps,
    generate_synthetic_reg_prices,
)


def test_myopic_revenue_le_perfect_foresight() -> None:
    """The lower bound must always be ≤ the upper bound."""
    lmps = generate_synthetic_lmps(n_days=3, seed=7)
    reg = generate_synthetic_reg_prices(lmps, seed=7)
    bp = BatteryParams()  # defaults

    pf = solve_perfect_foresight(lmps, reg["reg_cap_price"], reg["reg_perf_price"], battery=bp)
    my = solve_myopic_greedy(lmps, reg["reg_cap_price"], reg["reg_perf_price"], battery=bp)

    assert my.total_revenue <= pf.total_revenue + 1e-6


def test_myopic_does_not_charge_when_no_arbitrage_signal() -> None:
    """With flat LMP and zero reg, myopic should never pay to charge."""
    idx = pd.date_range("2024-06-01", periods=24, freq="1h", tz="UTC")
    lmps = pd.Series(np.full(24, 30.0), index=idx, name="lmp")
    zero = pd.Series(np.zeros(24), index=idx)
    bp = BatteryParams(E_initial=0.0)
    res = solve_myopic_greedy(lmps, zero, zero, battery=bp, dt_hours=1.0)
    assert res.schedule["c_mw"].max() < 1e-9
    assert res.schedule["d_mw"].max() < 1e-9
    assert res.total_revenue == pytest.approx(0.0, abs=1e-9)


def test_myopic_reg_only_when_only_reg_pays() -> None:
    """Flat LMP, positive reg cap, kappa>0: bid full reg every step."""
    idx = pd.date_range("2024-06-01", periods=4, freq="1h", tz="UTC")
    lmps = pd.Series(np.full(4, 30.0), index=idx, name="lmp")
    reg_cap = pd.Series(np.full(4, 10.0), index=idx)
    reg_perf = pd.Series(np.zeros(4), index=idx)
    bp = BatteryParams(E_initial=0.0, P_max=5.0, E_max=10.0,
                       eta_c=1.0, eta_d=1.0, kappa=2.0)
    res = solve_myopic_greedy(lmps, reg_cap, reg_perf, battery=bp, dt_hours=1.0)
    np.testing.assert_allclose(res.schedule["b_reg_mw"].to_numpy(), 5.0, atol=1e-9)
    assert res.total_revenue == pytest.approx(200.0, abs=1e-6)


def test_myopic_discharges_initial_soc_at_high_lmp() -> None:
    """Myopic should discharge initial SOC the first time it sees a profitable LMP."""
    idx = pd.date_range("2024-06-01", periods=2, freq="1h", tz="UTC")
    lmps = pd.Series([20.0, 80.0], index=idx, dtype=float, name="lmp")
    zero = pd.Series([0.0, 0.0], index=idx)
    # Note: myopic CANNOT see future, so it discharges in t=0 too if profitable.
    bp = BatteryParams(E_max=10.0, P_max=5.0, eta_c=1.0, eta_d=1.0, kappa=0.0,
                       E_initial=10.0, rho_assumed=0.95)
    res = solve_myopic_greedy(lmps, zero, zero, battery=bp, dt_hours=1.0)
    # With SOC=10 and P_max=5, both intervals can discharge 5 → revenue 5*20 + 5*80 = 500
    assert res.total_revenue == pytest.approx(500.0, abs=1e-6)


def test_myopic_charges_at_negative_lmp() -> None:
    """Negative LMP makes charging immediately profitable for myopic."""
    idx = pd.date_range("2024-06-01", periods=1, freq="1h", tz="UTC")
    lmps = pd.Series([-10.0], index=idx, dtype=float, name="lmp")
    zero = pd.Series([0.0], index=idx)
    bp = BatteryParams(E_max=10.0, P_max=5.0, eta_c=1.0, eta_d=1.0, kappa=0.0,
                       E_initial=0.0, rho_assumed=0.95)
    res = solve_myopic_greedy(lmps, zero, zero, battery=bp, dt_hours=1.0)
    assert res.schedule["c_mw"].iloc[0] == pytest.approx(5.0, abs=1e-6)


def test_myopic_runs_on_synthetic_dataset_quickly() -> None:
    """Sanity: 7 days of 5-min data must solve in < 2 s."""
    lmps = generate_synthetic_lmps(n_days=7, seed=11)
    reg = generate_synthetic_reg_prices(lmps, seed=11)
    res = solve_myopic_greedy(lmps, reg["reg_cap_price"], reg["reg_perf_price"])
    assert res.solve_time_seconds < 2.0
    assert len(res.schedule) == 7 * 24 * 12
