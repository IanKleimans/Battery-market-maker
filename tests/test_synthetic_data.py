"""Tests for src.utils.synthetic_data."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.utils.synthetic_data import (
    generate_synthetic_dataset,
    generate_synthetic_lmps,
    generate_synthetic_reg_prices,
)


def test_lmp_shape_and_index() -> None:
    s = generate_synthetic_lmps(n_days=7, freq_minutes=5, seed=0)
    assert isinstance(s, pd.Series)
    assert s.name == "lmp"
    assert len(s) == 7 * 24 * 12
    assert s.index.tz is not None
    # Index spacing
    deltas = s.index.to_series().diff().dropna().unique()
    assert len(deltas) == 1
    assert deltas[0] == pd.Timedelta("5min")


def test_lmp_non_negative_and_reasonable_mean() -> None:
    s = generate_synthetic_lmps(n_days=30, seed=42)
    assert (s >= 0).all()
    # spec: mean ≈ $35/MWh; allow ±$15 to absorb spike randomness
    assert 20.0 < s.mean() < 60.0


def test_lmp_has_diurnal_pattern() -> None:
    s = generate_synthetic_lmps(n_days=14, seed=1)
    et = s.index.tz_convert("America/New_York")
    by_hour = s.groupby(et.hour).mean()
    # Peak hours 17-19 ET should be higher than overnight 03-05 ET
    peak = by_hour.loc[17:19].mean()
    night = by_hour.loc[3:5].mean()
    assert peak > night


def test_lmp_seed_reproducibility() -> None:
    a = generate_synthetic_lmps(n_days=5, seed=123)
    b = generate_synthetic_lmps(n_days=5, seed=123)
    pd.testing.assert_series_equal(a, b)


def test_reg_prices_shape_and_alignment() -> None:
    lmps = generate_synthetic_lmps(n_days=5, seed=2)
    reg = generate_synthetic_reg_prices(lmps, seed=2)
    assert isinstance(reg, pd.DataFrame)
    assert list(reg.columns) == ["reg_cap_price", "reg_perf_price"]
    assert len(reg) == len(lmps)
    pd.testing.assert_index_equal(reg.index, lmps.index)


def test_reg_prices_non_negative_and_smaller_than_lmp_on_average() -> None:
    lmps = generate_synthetic_lmps(n_days=10, seed=3)
    reg = generate_synthetic_reg_prices(lmps, seed=3)
    assert (reg["reg_cap_price"] >= 0).all()
    assert (reg["reg_perf_price"] >= 0).all()
    assert reg["reg_cap_price"].mean() < lmps.mean()
    assert reg["reg_perf_price"].mean() < reg["reg_cap_price"].mean()


def test_reg_prices_require_tz_aware() -> None:
    lmps = generate_synthetic_lmps(n_days=2, seed=4)
    naive = lmps.copy()
    naive.index = naive.index.tz_localize(None)
    with pytest.raises(ValueError, match="tz-aware"):
        generate_synthetic_reg_prices(naive)


def test_combined_dataset_columns() -> None:
    df = generate_synthetic_dataset(n_days=2, seed=5)
    assert set(df.columns) == {"lmp", "reg_cap_price", "reg_perf_price"}
    assert df.index.name == "interval_start_utc"
    assert df.index.tz is not None


@pytest.mark.parametrize("bad", [0, -1])
def test_invalid_n_days_raises(bad: int) -> None:
    with pytest.raises(ValueError):
        generate_synthetic_lmps(n_days=bad)
