"""Tests for src.policies.types."""

from __future__ import annotations

import pandas as pd
import pytest

from src.policies.types import REQUIRED_SCHEDULE_COLUMNS, DispatchResult


def _good_schedule() -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=3, freq="5min", tz="UTC")
    return pd.DataFrame(
        {
            "c_mw": [0.0, 1.0, 0.0],
            "d_mw": [1.0, 0.0, 0.0],
            "b_reg_mw": [0.0, 0.0, 5.0],
            "E_mwh": [49.0, 50.0, 50.0],
            "lmp": [30.0, 25.0, 35.0],
            "reward": [2.5, -2.1, 1.4],
        },
        index=idx,
    )


def test_dispatch_result_accepts_well_formed_schedule() -> None:
    res = DispatchResult(
        schedule=_good_schedule(),
        total_revenue=1.8,
        energy_revenue=0.4,
        regulation_revenue=1.4,
        degradation_cost=0.2,
        solve_time_seconds=0.01,
        policy_name="unit-test",
    )
    assert set(REQUIRED_SCHEDULE_COLUMNS).issubset(res.schedule.columns)
    assert res.policy_name == "unit-test"


def test_missing_column_raises() -> None:
    sched = _good_schedule().drop(columns=["b_reg_mw"])
    with pytest.raises(ValueError, match="missing columns"):
        DispatchResult(
            schedule=sched,
            total_revenue=0.0,
            energy_revenue=0.0,
            regulation_revenue=0.0,
            degradation_cost=0.0,
            solve_time_seconds=0.0,
            policy_name="bad",
        )


def test_naive_index_raises() -> None:
    sched = _good_schedule()
    sched.index = sched.index.tz_localize(None)
    with pytest.raises(ValueError, match="tz-aware"):
        DispatchResult(
            schedule=sched,
            total_revenue=0.0,
            energy_revenue=0.0,
            regulation_revenue=0.0,
            degradation_cost=0.0,
            solve_time_seconds=0.0,
            policy_name="bad",
        )
