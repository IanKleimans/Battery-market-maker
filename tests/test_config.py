"""Tests for src.utils.config."""

from __future__ import annotations

import pytest

from src.utils.config import (
    DEFAULT_BATTERY,
    DEFAULT_RUN,
    BatteryParams,
    InvalidBatteryParams,
    RunConfig,
)


def test_default_battery_matches_spec() -> None:
    assert DEFAULT_BATTERY.E_max == 100.0
    assert DEFAULT_BATTERY.P_max == 50.0
    assert DEFAULT_BATTERY.eta_c == 0.92
    assert DEFAULT_BATTERY.eta_d == 0.92
    assert DEFAULT_BATTERY.kappa == 2.0
    assert DEFAULT_BATTERY.E_initial == 50.0
    assert DEFAULT_BATTERY.rho_assumed == 0.95


def test_round_trip_efficiency() -> None:
    bp = BatteryParams(eta_c=0.9, eta_d=0.8)
    assert bp.round_trip_efficiency == pytest.approx(0.72)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"E_max": 0.0},
        {"E_max": -1.0},
        {"P_max": 0.0},
        {"eta_c": 0.0},
        {"eta_c": 1.5},
        {"eta_d": -0.1},
        {"kappa": -1.0},
        {"E_initial": -1.0},
        {"E_initial": 1000.0},      # > E_max default
        {"rho_assumed": -0.1},
        {"rho_assumed": 1.5},
    ],
)
def test_invalid_params_raise(kwargs: dict) -> None:
    with pytest.raises(InvalidBatteryParams):
        BatteryParams(**kwargs)


def test_default_run_dt_is_five_minutes() -> None:
    assert DEFAULT_RUN.dt_hours == pytest.approx(5.0 / 60.0)


def test_run_config_negative_dt_raises() -> None:
    with pytest.raises(InvalidBatteryParams):
        RunConfig(dt_hours=0)
