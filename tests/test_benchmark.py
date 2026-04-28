"""Tests for src.eval.benchmark."""

from __future__ import annotations

import pandas as pd
import pytest

from src.eval.benchmark import run_benchmark
from src.policies.myopic_greedy import solve_myopic_greedy
from src.policies.perfect_foresight_lp import solve_perfect_foresight
from src.utils.synthetic_data import generate_synthetic_dataset


def test_benchmark_basic_structure() -> None:
    data = generate_synthetic_dataset(n_days=2, seed=8)
    bench = run_benchmark(
        data,
        policies={
            "perfect_foresight_lp": solve_perfect_foresight,
            "myopic_greedy": solve_myopic_greedy,
        },
    )
    df = bench.table
    assert set(df.columns) >= {
        "policy",
        "total_revenue",
        "energy_revenue",
        "regulation_revenue",
        "degradation_cost",
        "revenue_per_kw_year",
        "runtime_seconds",
        "optimality_gap",
    }
    assert set(df["policy"]) == {"perfect_foresight_lp", "myopic_greedy"}


def test_optimality_gap_anchors_at_0_and_1() -> None:
    data = generate_synthetic_dataset(n_days=2, seed=9)
    bench = run_benchmark(
        data,
        policies={
            "perfect_foresight_lp": solve_perfect_foresight,
            "myopic_greedy": solve_myopic_greedy,
        },
    )
    gap_pf = float(
        bench.table.loc[bench.table["policy"] == "perfect_foresight_lp", "optimality_gap"].iloc[0]
    )
    gap_g = float(
        bench.table.loc[bench.table["policy"] == "myopic_greedy", "optimality_gap"].iloc[0]
    )
    assert gap_pf == pytest.approx(1.0, abs=1e-9)
    assert gap_g == pytest.approx(0.0, abs=1e-9)


def test_benchmark_rejects_missing_columns() -> None:
    bad = pd.DataFrame({"foo": [1.0, 2.0]}, index=pd.date_range("2024-01-01", periods=2, freq="5min", tz="UTC"))
    with pytest.raises(ValueError, match="missing required columns"):
        run_benchmark(bad, policies={})


def test_revenue_per_kw_year_is_positive_for_pf() -> None:
    data = generate_synthetic_dataset(n_days=3, seed=10)
    bench = run_benchmark(
        data,
        policies={
            "perfect_foresight_lp": solve_perfect_foresight,
            "myopic_greedy": solve_myopic_greedy,
        },
    )
    pf_rev = float(
        bench.table.loc[bench.table["policy"] == "perfect_foresight_lp", "revenue_per_kw_year"].iloc[0]
    )
    assert pf_rev > 0
