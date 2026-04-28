"""Tests for src.utils.pjm_data_loader.

We don't ship real PJM CSVs, so these tests synthesise small fixtures matching
the Data Miner 2 schema and verify the loader's behaviour.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from src.utils.pjm_data_loader import (
    IncompleteDataError,
    _ffill_with_gap_check,
    align_lmp_and_reg,
    find_real_or_synthetic,
    load_reg_prices,
    load_rt_lmps,
)


def _write_lmp_fixture(tmp_path: Path, rows: list[tuple[str, int, float]]) -> Path:
    fp = tmp_path / "rt_lmps.csv"
    df = pd.DataFrame(rows, columns=["datetime_beginning_ept", "pnode_id", "total_lmp_rt"])
    df.to_csv(fp, index=False)
    return fp


def test_load_rt_lmps_basic(tmp_path: Path) -> None:
    rows = [
        ("2024-06-01 00:00:00", 12345, 30.5),
        ("2024-06-01 00:05:00", 12345, 31.0),
        ("2024-06-01 00:10:00", 12345, 30.0),
        ("2024-06-01 00:15:00", 99999, 1000.0),  # different pnode, must be filtered
    ]
    fp = _write_lmp_fixture(tmp_path, rows)
    s = load_rt_lmps(fp, pnode_id=12345)
    assert s.name == "lmp"
    assert s.index.tz is not None
    assert len(s) == 3
    assert s.iloc[0] == pytest.approx(30.5)


def test_load_rt_lmps_ffills_short_gap(tmp_path: Path) -> None:
    # Two-interval gap (00:05 and 00:10 missing -> exactly 2 intervals filled)
    rows = [
        ("2024-06-01 00:00:00", 1, 20.0),
        ("2024-06-01 00:15:00", 1, 25.0),
    ]
    fp = _write_lmp_fixture(tmp_path, rows)
    s = load_rt_lmps(fp, pnode_id=1)
    assert len(s) == 4
    assert s.iloc[0] == 20.0
    assert s.iloc[1] == 20.0  # ffilled
    assert s.iloc[2] == 20.0  # ffilled
    assert s.iloc[3] == 25.0


def test_load_rt_lmps_raises_on_long_gap(tmp_path: Path) -> None:
    rows = [
        ("2024-06-01 00:00:00", 1, 20.0),
        ("2024-06-01 00:30:00", 1, 25.0),  # 5 missing intervals
    ]
    fp = _write_lmp_fixture(tmp_path, rows)
    with pytest.raises(IncompleteDataError):
        load_rt_lmps(fp, pnode_id=1)


def test_load_rt_lmps_missing_columns(tmp_path: Path) -> None:
    fp = tmp_path / "bad.csv"
    pd.DataFrame({"foo": [1], "bar": [2]}).to_csv(fp, index=False)
    with pytest.raises(ValueError, match="missing required columns"):
        load_rt_lmps(fp, pnode_id=1)


def test_load_rt_lmps_unknown_pnode(tmp_path: Path) -> None:
    fp = _write_lmp_fixture(tmp_path, [("2024-06-01 00:00:00", 1, 20.0)])
    with pytest.raises(ValueError, match="No rows for pnode_id"):
        load_rt_lmps(fp, pnode_id=999)


def test_load_rt_lmps_file_missing() -> None:
    with pytest.raises(FileNotFoundError):
        load_rt_lmps("nonexistent_file.csv", pnode_id=1)


def test_load_reg_prices(tmp_path: Path) -> None:
    fp = tmp_path / "reg.csv"
    pd.DataFrame(
        {
            "datetime_beginning_ept": ["2024-06-01 00:00:00", "2024-06-01 01:00:00"],
            "rmccp": [10.0, 12.0],
            "rmpcp": [3.0, 4.0],
        }
    ).to_csv(fp, index=False)
    df = load_reg_prices(fp)
    assert list(df.columns) == ["reg_cap_price", "reg_perf_price"]
    assert df.index.tz is not None
    # 5-min expansion: 12 intervals from 00:00 + ffill across the second hour
    assert len(df) >= 12
    assert df["reg_cap_price"].iloc[0] == 10.0
    assert df["reg_cap_price"].iloc[6] == 10.0  # within first hour, ffilled


def test_align_lmp_and_reg() -> None:
    idx = pd.date_range("2024-06-01", periods=4, freq="5min", tz="UTC")
    lmps = pd.Series([20, 25, 30, 35], index=idx, name="lmp", dtype=float)
    reg = pd.DataFrame(
        {"reg_cap_price": [5.0, 5.0, 5.0, 5.0], "reg_perf_price": [1.0, 1.0, 1.0, 1.0]},
        index=idx,
    )
    out = align_lmp_and_reg(lmps, reg)
    assert list(out.columns) == ["lmp", "reg_cap_price", "reg_perf_price"]
    assert len(out) == 4


def test_ffill_helper_run_detection() -> None:
    s = pd.Series([1.0, None, None, None, 5.0])
    with pytest.raises(IncompleteDataError):
        _ffill_with_gap_check(s, max_consecutive=2)

    s2 = pd.Series([1.0, None, None, 4.0])
    out = _ffill_with_gap_check(s2, max_consecutive=2)
    assert out.tolist() == [1.0, 1.0, 1.0, 4.0]


def test_find_real_or_synthetic(tmp_path: Path) -> None:
    using, label = find_real_or_synthetic(tmp_path)
    assert using is False
    assert "Synthetic" in label

    (tmp_path / "rt_lmps.csv").write_text("dummy")
    using, label = find_real_or_synthetic(tmp_path)
    assert using is True
    assert "Real" in label
