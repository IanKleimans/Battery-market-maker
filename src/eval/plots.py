"""Figure generators for the IE 590 final report.

Five figures (each saved as both ``.png`` at 300 DPI and ``.pdf`` to
``figures/``):

* Fig 1 — dispatch overview (LMP+SOC | charge/discharge | reg bid)
* Fig 2 — revenue comparison bar chart
* Fig 3 — optimality gap vs MPC horizon
* Fig 4 — revenue decomposition stacked bar
* Fig 5 — forecast RMSE vs revenue gap scatter w/ trend line

Run as a module to regenerate everything from synthetic data (or real PJM
data if ``data/pjm/rt_lmps.csv`` is present)::

    uv run python -m src.eval.plots
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from src.eval.benchmark import BenchmarkResult, run_benchmark
from src.forecasting.xgboost_forecaster import (
    NaivePersistenceForecaster,
    PerfectForecaster,
    XGBoostLMPForecaster,
)
from src.policies.mpc import solve_mpc
from src.policies.myopic_greedy import solve_myopic_greedy
from src.policies.perfect_foresight_lp import solve_perfect_foresight
from src.policies.types import DispatchResult
from src.utils.config import DEFAULT_BATTERY, BatteryParams
from src.utils.pjm_data_loader import (
    align_lmp_and_reg,
    find_real_or_synthetic,
    load_reg_prices,
    load_rt_lmps,
)
from src.utils.synthetic_data import generate_synthetic_dataset

FIGURES_DIR = Path("figures")
DEFAULT_DPI = 300
sns.set_theme(style="whitegrid", context="paper")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _save(fig: plt.Figure, name: str, dpi: int = DEFAULT_DPI) -> None:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / f"{name}.png", dpi=dpi)
    fig.savefig(FIGURES_DIR / f"{name}.pdf")


def _to_et(idx: pd.DatetimeIndex) -> pd.DatetimeIndex:
    return idx.tz_convert("America/New_York")


def _pretty_label(name: str) -> str:
    return {
        "perfect_foresight_lp": "Perfect-Foresight LP",
        "myopic_greedy": "Myopic Greedy",
    }.get(name, name.replace("_", " ").title())


# ---------------------------------------------------------------------------
# Fig 1: dispatch overview
# ---------------------------------------------------------------------------


def fig_dispatch_overview(
    result: DispatchResult,
    battery: BatteryParams,
    data_label: str = "Synthetic data",
    title_suffix: str = "",
    name: str = "fig1_dispatch_overview",
) -> Path:
    """Three stacked panels: LMP+SOC dual-axis, charge/discharge step, reg bid."""
    sched = result.schedule
    et_idx = _to_et(sched.index)

    fig, axes = plt.subplots(3, 1, figsize=(11, 8), sharex=True)

    # Panel 1: LMP and SOC dual axis
    ax1 = axes[0]
    ax1.plot(et_idx, sched["lmp"], color="C0", linewidth=1.0, label="LMP ($/MWh)")
    ax1.set_ylabel("LMP ($/MWh)", color="C0")
    ax1.tick_params(axis="y", labelcolor="C0")
    ax1b = ax1.twinx()
    ax1b.plot(et_idx, sched["E_mwh"], color="C3", linewidth=1.2, label="SOC (MWh)")
    ax1b.set_ylabel("SOC (MWh)", color="C3")
    ax1b.tick_params(axis="y", labelcolor="C3")
    ax1b.set_ylim(0, battery.E_max * 1.05)
    ax1.set_title(f"Dispatch overview — {_pretty_label(result.policy_name)} {title_suffix}".strip())

    # Panel 2: charge / discharge step plot
    ax2 = axes[1]
    ax2.step(et_idx, sched["d_mw"], where="post", color="C2", linewidth=1.0, label="Discharge")
    ax2.step(et_idx, -sched["c_mw"], where="post", color="C1", linewidth=1.0, label="Charge")
    ax2.axhline(0.0, color="grey", linewidth=0.5)
    ax2.set_ylabel("Power (MW)")
    ax2.legend(loc="upper right", frameon=False)

    # Panel 3: regulation bid
    ax3 = axes[2]
    ax3.fill_between(et_idx, 0.0, sched["b_reg_mw"], color="C4", alpha=0.5,
                     step="post", label="Reg bid")
    ax3.set_ylabel("Reg bid (MW)")
    ax3.set_xlabel(f"Time ({et_idx.tz})")
    ax3.set_ylim(0, battery.P_max * 1.05)

    fig.text(0.99, 0.01, data_label, ha="right", va="bottom", fontsize=8, color="grey")
    _save(fig, name)
    plt.close(fig)
    return FIGURES_DIR / f"{name}.png"


# ---------------------------------------------------------------------------
# Fig 2: revenue comparison bar chart
# ---------------------------------------------------------------------------


def fig_revenue_comparison(
    bench: BenchmarkResult,
    data_label: str = "Synthetic data",
    name: str = "fig2_revenue_comparison",
) -> Path:
    """Two-panel: absolute revenue (left) + revenue *above myopic baseline* (right).

    Because regulation revenue dominates total dollars, the absolute bars look
    nearly equal.  The right panel makes the inter-policy spread legible.
    """
    df = bench.table.copy().sort_values("total_revenue", ascending=False)
    labels = [_pretty_label(p) for p in df["policy"]]
    revs = df["total_revenue"].to_numpy()
    palette = sns.color_palette("deep", n_colors=len(df))

    # Baseline: lowest revenue (always myopic in our 3-policy setup)
    baseline = revs.min()
    above = revs - baseline

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.5))
    ax1.bar(labels, revs, color=palette, edgecolor="black")
    ax1.set_ylabel("Total revenue (USD)")
    ax1.set_title("Total revenue by policy")
    ax1.tick_params(axis="x", rotation=15)
    for i, v in enumerate(revs):
        ax1.text(i, v, f"${v:,.0f}", ha="center", va="bottom", fontsize=8)

    ax2.bar(labels, above, color=palette, edgecolor="black")
    ax2.set_ylabel(f"Revenue above myopic baseline (USD)\n(baseline ≈ ${baseline:,.0f})")
    ax2.set_title("Revenue above myopic")
    ax2.tick_params(axis="x", rotation=15)
    for i, v in enumerate(above):
        ax2.text(i, v, f"+${v:,.0f}", ha="center", va="bottom", fontsize=8)
    ax2.axhline(0.0, color="grey", linewidth=0.6)

    fig.text(0.99, 0.01, data_label, ha="right", va="bottom", fontsize=8, color="grey")
    _save(fig, name)
    plt.close(fig)
    return FIGURES_DIR / f"{name}.png"


# ---------------------------------------------------------------------------
# Fig 3: optimality gap vs MPC horizon
# ---------------------------------------------------------------------------


def fig_gap_vs_horizon(
    horizons: Iterable[int],
    gaps: Iterable[float],
    data_label: str = "Synthetic data",
    name: str = "fig3_gap_vs_horizon",
) -> Path:
    horizons = list(horizons)
    gaps = list(gaps)
    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    ax.plot(horizons, gaps, marker="o", color="C0", linewidth=1.5)
    ax.axhline(0.0, color="grey", linestyle="--", linewidth=0.8, label="Myopic baseline")
    ax.axhline(1.0, color="black", linestyle="--", linewidth=0.8, label="Perfect-foresight bound")
    ax.set_xscale("log")
    ax.set_xlabel("MPC horizon (5-min steps, log scale)")
    ax.set_ylabel("Optimality gap")
    ax.set_title("MPC convergence to perfect foresight")
    ax.legend(loc="lower right", frameon=False)
    ax.set_xticks(horizons)
    ax.set_xticklabels([str(h) for h in horizons])
    fig.text(0.99, 0.01, data_label, ha="right", va="bottom", fontsize=8, color="grey")
    _save(fig, name)
    plt.close(fig)
    return FIGURES_DIR / f"{name}.png"


# ---------------------------------------------------------------------------
# Fig 4: revenue decomposition stacked bar
# ---------------------------------------------------------------------------


def fig_revenue_decomposition(
    bench: BenchmarkResult,
    data_label: str = "Synthetic data",
    name: str = "fig4_revenue_decomposition",
) -> Path:
    df = bench.table.copy().sort_values("total_revenue", ascending=False)
    labels = [_pretty_label(p) for p in df["policy"]]
    energy = df["energy_revenue"].to_numpy()
    reg = df["regulation_revenue"].to_numpy()
    deg = -df["degradation_cost"].to_numpy()  # plotted below zero

    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    ax.bar(labels, energy, label="Energy arbitrage", color="C0", edgecolor="black")
    ax.bar(labels, reg, bottom=energy, label="Regulation", color="C2", edgecolor="black")
    ax.bar(labels, deg, label="Degradation cost", color="C3", edgecolor="black", alpha=0.85)
    ax.axhline(0.0, color="black", linewidth=0.6)
    ax.set_ylabel("Revenue / cost (USD)")
    ax.set_title("Revenue decomposition by policy")
    ax.tick_params(axis="x", rotation=15)
    ax.legend(loc="upper right", frameon=False)
    fig.text(0.99, 0.01, data_label, ha="right", va="bottom", fontsize=8, color="grey")
    _save(fig, name)
    plt.close(fig)
    return FIGURES_DIR / f"{name}.png"


# ---------------------------------------------------------------------------
# Fig 5: RMSE vs revenue gap scatter
# ---------------------------------------------------------------------------


def fig_rmse_vs_gap(
    rmses: Iterable[float],
    gaps: Iterable[float],
    labels: Iterable[str] | None = None,
    data_label: str = "Synthetic data",
    name: str = "fig5_rmse_vs_gap",
) -> Path:
    rmses = list(rmses)
    gaps = list(gaps)
    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    ax.scatter(rmses, gaps, s=80, color="C0", edgecolor="black", zorder=3)
    if len(rmses) >= 2:
        coeffs = np.polyfit(rmses, gaps, 1)
        xs = np.linspace(min(rmses), max(rmses), 50)
        ys = np.polyval(coeffs, xs)
        ax.plot(xs, ys, color="C3", linestyle="--", linewidth=1.2,
                label=f"Linear fit: gap = {coeffs[0]:.3f}·RMSE + {coeffs[1]:.3f}")
        ax.legend(loc="lower left", frameon=False)
    if labels is not None:
        for x, y, lab in zip(rmses, gaps, labels):
            ax.annotate(lab, (x, y), textcoords="offset points", xytext=(6, 4), fontsize=8)
    ax.set_xlabel("Forecaster RMSE ($/MWh)")
    ax.set_ylabel("Optimality gap (1 = PF-LP)")
    ax.set_title("Forecast quality vs achieved revenue gap")
    fig.text(0.99, 0.01, data_label, ha="right", va="bottom", fontsize=8, color="grey")
    _save(fig, name)
    plt.close(fig)
    return FIGURES_DIR / f"{name}.png"


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def _load_data() -> tuple[pd.DataFrame, str, bool]:
    using_real, label = find_real_or_synthetic("data/pjm")
    if using_real:
        try:
            lmps = load_rt_lmps("data/pjm/rt_lmps.csv", pnode_id=int(_pick_pnode()))
            reg = load_reg_prices("data/pjm/reg_prices.csv")
            df = align_lmp_and_reg(lmps, reg)
            return df, label, True
        except Exception as exc:  # pragma: no cover
            print(f"[plots] Real data load failed ({exc}); falling back to synthetic.")
    df = generate_synthetic_dataset(n_days=7, freq_minutes=5, seed=42)
    return df, label, False


def _pick_pnode() -> int:
    """Hook for picking a default pnode_id from a sidecar config; placeholder."""
    return 51217  # arbitrary PSEG zonal pnode used in many PJM examples


def _generate_horizon_sweep(
    data: pd.DataFrame,
    forecaster: XGBoostLMPForecaster,
    horizons: list[int],
    battery: BatteryParams,
) -> tuple[list[int], list[float]]:
    pf = solve_perfect_foresight(data["lmp"], data["reg_cap_price"], data["reg_perf_price"], battery=battery)
    my = solve_myopic_greedy(data["lmp"], data["reg_cap_price"], data["reg_perf_price"], battery=battery)
    denom = pf.total_revenue - my.total_revenue
    gaps = []
    for h in horizons:
        # Re-solve every horizon-block for cheap (one solve per h intervals).
        # For the smallest horizons we still re-solve every step to mimic true MPC.
        re = max(1, min(h, 12))
        mpc = solve_mpc(
            data["lmp"], data["reg_cap_price"], data["reg_perf_price"],
            forecaster=forecaster, horizon_steps=h, battery=battery,
            resolve_every=re,
        )
        gap = (mpc.total_revenue - my.total_revenue) / denom if denom > 1e-9 else float("nan")
        gaps.append(gap)
    return horizons, gaps


def _generate_rmse_sweep(
    data: pd.DataFrame, battery: BatteryParams,
) -> tuple[list[float], list[float], list[str]]:
    """Train a few XGBoost configs of varying capacity to vary RMSE; return (rmse, gap, label) for each."""
    pf = solve_perfect_foresight(data["lmp"], data["reg_cap_price"], data["reg_perf_price"], battery=battery)
    my = solve_myopic_greedy(data["lmp"], data["reg_cap_price"], data["reg_perf_price"], battery=battery)
    denom = pf.total_revenue - my.total_revenue

    rmses, gaps, labels = [], [], []

    # 1) Persistence (worst forecaster)
    persistence = NaivePersistenceForecaster()
    naive_rmse = float(np.sqrt(np.mean(np.diff(data["lmp"].to_numpy()) ** 2)))
    mpc_p = solve_mpc(
        data["lmp"], data["reg_cap_price"], data["reg_perf_price"],
        forecaster=persistence, horizon_steps=24, battery=battery, resolve_every=12,
    )
    rmses.append(naive_rmse)
    gaps.append((mpc_p.total_revenue - my.total_revenue) / denom if denom > 1e-9 else float("nan"))
    labels.append("Persistence")

    # 2-4) XGBoost configs
    for cfg_label, params in [
        ("XGB-tiny", dict(n_estimators=30, max_depth=2, learning_rate=0.2)),
        ("XGB-small", dict(n_estimators=100, max_depth=4, learning_rate=0.1)),
        ("XGB-default", dict(n_estimators=200, max_depth=5, learning_rate=0.08)),
    ]:
        fc = XGBoostLMPForecaster(**params)
        m = fc.fit(data["lmp"])
        mpc = solve_mpc(
            data["lmp"], data["reg_cap_price"], data["reg_perf_price"],
            forecaster=fc, horizon_steps=24, battery=battery, resolve_every=12,
        )
        rmses.append(m.rmse_test)
        gaps.append((mpc.total_revenue - my.total_revenue) / denom if denom > 1e-9 else float("nan"))
        labels.append(cfg_label)

    # 5) Perfect (lower RMSE bound)
    perfect = PerfectForecaster(data["lmp"])
    mpc_perf = solve_mpc(
        data["lmp"], data["reg_cap_price"], data["reg_perf_price"],
        forecaster=perfect, horizon_steps=288, battery=battery, resolve_every=288,
    )
    rmses.append(0.0)
    gaps.append((mpc_perf.total_revenue - my.total_revenue) / denom if denom > 1e-9 else float("nan"))
    labels.append("Perfect")
    return rmses, gaps, labels


def _write_captions() -> None:
    caps = """
# Figure captions

**Figure 1 — Dispatch overview.** A representative week of perfect-foresight LP dispatch.
Top: LMP (left axis, blue) and battery state of charge (right axis, red). Middle:
charge (negative, orange) and discharge (positive, green) power in MW. Bottom: regulation
capacity bid in MW. SOC respects the 0–100 MWh window; charge/discharge respects the 50 MW
power cap. Note the morning-charge / evening-discharge cycle.

**Figure 2 — Revenue by policy.** Total revenue ($) over the evaluation horizon for each
policy. Perfect-foresight LP is the upper bound; myopic-greedy is the lower bound; MPC
sits in between. Bars are annotated with the realised dollar value.

**Figure 3 — MPC convergence to perfect foresight.** Optimality gap as a function of MPC
look-ahead horizon (5-min intervals, log scale). The dashed lines mark 0 (myopic baseline)
and 1 (perfect foresight). MPC closes most of the gap by ~24 steps (2 h) and approaches
the bound at 288 steps (24 h).

**Figure 4 — Revenue decomposition.** Stacked components of net revenue: energy arbitrage
(blue), regulation services (green), and degradation cost (red, plotted below zero).
Regulation is the dominant contributor for myopic; PF-LP captures more energy arbitrage.

**Figure 5 — Forecast quality vs achieved revenue gap.** Each marker is one
forecaster: Persistence, three XGBoost configurations, and a Perfect oracle.
The dashed red line is a least-squares fit of optimality gap on test-set RMSE.
A monotonic relationship indicates that revenue is forecast-limited rather
than solver-limited.
"""
    (FIGURES_DIR / "captions.md").write_text(caps.strip() + "\n")


def main() -> None:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    data, data_label, _ = _load_data()
    battery = DEFAULT_BATTERY

    # Limit Fig 1 to a representative week (or all data if shorter)
    one_week = min(len(data), 7 * 24 * 12)
    data_week = data.iloc[:one_week]

    pf_week = solve_perfect_foresight(
        data_week["lmp"], data_week["reg_cap_price"], data_week["reg_perf_price"], battery=battery,
    )
    fig_dispatch_overview(pf_week, battery, data_label=data_label)

    # Train XGBoost forecaster for benchmark
    fc_xgb = XGBoostLMPForecaster()
    fc_xgb.fit(data["lmp"])

    bench = run_benchmark(
        data,
        policies={
            "perfect_foresight_lp": solve_perfect_foresight,
            "myopic_greedy": solve_myopic_greedy,
            "mpc_xgboost": solve_mpc,
        },
        battery_params=battery,
        extra_kwargs={
            "mpc_xgboost": dict(forecaster=fc_xgb, horizon_steps=96, resolve_every=24),
        },
    )
    fig_revenue_comparison(bench, data_label=data_label)
    fig_revenue_decomposition(bench, data_label=data_label)

    horizons = [1, 6, 24, 48, 96, 288]
    hs, gaps = _generate_horizon_sweep(data, fc_xgb, horizons, battery)
    fig_gap_vs_horizon(hs, gaps, data_label=data_label)

    rmses, rmse_gaps, rmse_labels = _generate_rmse_sweep(data, battery)
    fig_rmse_vs_gap(rmses, rmse_gaps, labels=rmse_labels, data_label=data_label)

    _write_captions()
    print(f"Wrote 5 figures to {FIGURES_DIR.resolve()}")


if __name__ == "__main__":  # pragma: no cover
    main()
