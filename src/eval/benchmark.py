"""Benchmark runner: collect revenue / runtime metrics across policies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping

import pandas as pd

from src.policies.types import DispatchResult
from src.utils.config import DEFAULT_BATTERY, BatteryParams

PolicyCallable = Callable[[pd.Series, pd.Series, pd.Series, BatteryParams, float], DispatchResult]


_HOURS_PER_YEAR = 8760.0


def _revenue_per_kw_year(total_revenue: float, P_max_mw: float, n_intervals: int, dt_hours: float) -> float:
    """Annualise revenue to USD per kW of installed power per year."""
    horizon_hours = n_intervals * dt_hours
    if horizon_hours <= 0 or P_max_mw <= 0:
        return float("nan")
    annualised = total_revenue * (_HOURS_PER_YEAR / horizon_hours)
    P_max_kw = P_max_mw * 1000.0
    return annualised / P_max_kw


@dataclass
class BenchmarkResult:
    """Convenience wrapper that bundles the per-policy DataFrame + raw outputs."""

    table: pd.DataFrame
    dispatch_results: dict[str, DispatchResult]


def run_benchmark(
    data: pd.DataFrame,
    policies: Mapping[str, Callable[..., DispatchResult]],
    battery_params: BatteryParams = DEFAULT_BATTERY,
    dt_hours: float = 5.0 / 60.0,
    rho_assumed: float = 0.95,
    pf_policy_name: str = "perfect_foresight_lp",
    greedy_policy_name: str = "myopic_greedy",
    extra_kwargs: Mapping[str, dict] | None = None,
) -> BenchmarkResult:
    """Run all policies on ``data`` and return a comparison table.

    Parameters
    ----------
    data
        DataFrame with columns ``lmp``, ``reg_cap_price``, ``reg_perf_price``
        and a tz-aware UTC index.
    policies
        Mapping from a label to a policy callable.  Each callable must accept
        ``(lmps, reg_cap, reg_perf, battery, dt_hours, rho_assumed, **extra)``.
    battery_params, dt_hours, rho_assumed
        Forwarded to every policy.
    pf_policy_name, greedy_policy_name
        Labels used to compute the optimality gap

            gap = (V_pi - V_greedy) / (V_PF - V_greedy)

        If either label is absent from the table, ``optimality_gap`` is NaN.
    extra_kwargs
        Optional mapping of label → kwargs passed only to that policy
        (e.g. ``{"mpc_xgb": {"forecaster": fc, "horizon_steps": 96}}``).

    Returns
    -------
    BenchmarkResult
        Object with a ``table`` DataFrame and ``dispatch_results`` dict.
    """
    required = {"lmp", "reg_cap_price", "reg_perf_price"}
    missing = required - set(data.columns)
    if missing:
        raise ValueError(f"data missing required columns {missing}; got {list(data.columns)}")
    if data.index.tz is None:
        raise ValueError("data must have a tz-aware index")

    extra_kwargs = dict(extra_kwargs or {})
    rows: list[dict] = []
    results: dict[str, DispatchResult] = {}

    n = len(data)

    for label, policy in policies.items():
        kwargs = extra_kwargs.get(label, {})
        result = policy(
            data["lmp"],
            data["reg_cap_price"],
            data["reg_perf_price"],
            battery=battery_params,
            dt_hours=dt_hours,
            rho_assumed=rho_assumed,
            **kwargs,
        )
        results[label] = result
        rows.append(
            {
                "policy": label,
                "total_revenue": result.total_revenue,
                "energy_revenue": result.energy_revenue,
                "regulation_revenue": result.regulation_revenue,
                "degradation_cost": result.degradation_cost,
                "revenue_per_kw_year": _revenue_per_kw_year(
                    result.total_revenue, battery_params.P_max, n, dt_hours
                ),
                "runtime_seconds": result.solve_time_seconds,
                "n_intervals": n,
            }
        )

    df = pd.DataFrame(rows)
    df = _attach_optimality_gap(df, pf_policy_name, greedy_policy_name)
    return BenchmarkResult(table=df, dispatch_results=results)


def _attach_optimality_gap(
    df: pd.DataFrame, pf_name: str, greedy_name: str
) -> pd.DataFrame:
    if pf_name not in df["policy"].values or greedy_name not in df["policy"].values:
        df["optimality_gap"] = float("nan")
        return df
    V_pf = float(df.loc[df["policy"] == pf_name, "total_revenue"].iloc[0])
    V_g = float(df.loc[df["policy"] == greedy_name, "total_revenue"].iloc[0])
    denom = V_pf - V_g
    if abs(denom) < 1e-9:
        df["optimality_gap"] = float("nan")
    else:
        df["optimality_gap"] = (df["total_revenue"] - V_g) / denom
    return df
