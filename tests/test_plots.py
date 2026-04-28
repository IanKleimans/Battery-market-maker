"""Smoke tests for src.eval.plots — ensure each figure routine writes its files."""

from __future__ import annotations

from pathlib import Path

import matplotlib
import pytest

matplotlib.use("Agg")

from src.eval import plots
from src.eval.benchmark import run_benchmark
from src.policies.myopic_greedy import solve_myopic_greedy
from src.policies.perfect_foresight_lp import solve_perfect_foresight
from src.utils.config import DEFAULT_BATTERY
from src.utils.synthetic_data import generate_synthetic_dataset


@pytest.fixture
def temp_figdir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(plots, "FIGURES_DIR", tmp_path)
    return tmp_path


def test_dispatch_overview_writes_png_and_pdf(temp_figdir: Path) -> None:
    data = generate_synthetic_dataset(n_days=2, seed=0)
    res = solve_perfect_foresight(
        data["lmp"], data["reg_cap_price"], data["reg_perf_price"], battery=DEFAULT_BATTERY
    )
    plots.fig_dispatch_overview(res, DEFAULT_BATTERY, name="t1")
    assert (temp_figdir / "t1.png").exists()
    assert (temp_figdir / "t1.pdf").exists()


def test_revenue_and_decomp_figures(temp_figdir: Path) -> None:
    data = generate_synthetic_dataset(n_days=1, seed=1)
    bench = run_benchmark(
        data,
        policies={
            "perfect_foresight_lp": solve_perfect_foresight,
            "myopic_greedy": solve_myopic_greedy,
        },
    )
    plots.fig_revenue_comparison(bench, name="t2")
    plots.fig_revenue_decomposition(bench, name="t3")
    assert (temp_figdir / "t2.png").exists()
    assert (temp_figdir / "t3.png").exists()


def test_gap_vs_horizon_and_rmse(temp_figdir: Path) -> None:
    plots.fig_gap_vs_horizon([1, 6, 24, 96], [0.0, 0.4, 0.8, 0.95], name="t4")
    plots.fig_rmse_vs_gap([0.0, 1.0, 5.0], [1.0, 0.85, 0.4], labels=["a", "b", "c"], name="t5")
    assert (temp_figdir / "t4.png").exists()
    assert (temp_figdir / "t5.png").exists()
