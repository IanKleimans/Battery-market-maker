"""Perfect-foresight linear program for battery co-optimisation.

Solves

    max  sum_t [ lmp_t * (d_t - c_t) * dt
                 + reg_cap_t * b_reg_t * dt
                 + reg_perf_t * rho * b_reg_t * dt
                 - kappa * (c_t + d_t) * dt ]

    s.t. 0 <= c_t, d_t <= P_max
         c_t + d_t <= P_max                              (single-direction)
         0 <= b_reg_t <= P_max - c_t - d_t               (bid w/in headroom)
         E_{t+1} = E_t + eta_c * c_t * dt - d_t * dt / eta_d
         0 <= E_t <= E_max
         E_0 = E_initial

The continuous LP is solved with HiGHS via cvxpy.  A relaxation note:
the simultaneous (c_t > 0, d_t > 0) configuration is technically allowed by
the linear program but is *suboptimal* whenever ``kappa * dt > 0`` (every
joint MWh of throughput pays ``2 * kappa * dt`` for zero net energy and zero
extra reg headroom).  Tests assert that solutions never produce simultaneous
charge and discharge.

This module provides the upper-bound benchmark in the report.  The same
``_build_problem`` function is reused by the MPC policy.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import cvxpy as cp
import numpy as np
import pandas as pd

from src.policies.types import DispatchResult
from src.utils.config import DEFAULT_BATTERY, BatteryParams


@dataclass(frozen=True)
class _LpInputs:
    """Internal: cleaned, length-T arrays passed to the LP."""

    lmp: np.ndarray
    reg_cap: np.ndarray
    reg_perf: np.ndarray
    dt_hours: float
    rho: float


def _validate_and_align(
    lmps: pd.Series,
    reg_cap_prices: pd.Series,
    reg_perf_prices: pd.Series,
    dt_hours: float,
    rho_assumed: float,
) -> tuple[pd.DatetimeIndex, _LpInputs]:
    if lmps.index.tz is None:
        raise ValueError("lmps must be tz-aware")
    if not lmps.index.equals(reg_cap_prices.index):
        raise ValueError("lmps and reg_cap_prices must share an index")
    if not lmps.index.equals(reg_perf_prices.index):
        raise ValueError("lmps and reg_perf_prices must share an index")
    if dt_hours <= 0:
        raise ValueError(f"dt_hours must be positive, got {dt_hours}")
    if not (0.0 <= rho_assumed <= 1.0):
        raise ValueError(f"rho_assumed must be in [0, 1], got {rho_assumed}")

    inputs = _LpInputs(
        lmp=np.asarray(lmps.to_numpy(), dtype=float),
        reg_cap=np.asarray(reg_cap_prices.to_numpy(), dtype=float),
        reg_perf=np.asarray(reg_perf_prices.to_numpy(), dtype=float),
        dt_hours=float(dt_hours),
        rho=float(rho_assumed),
    )
    return lmps.index, inputs


def _build_problem(
    inputs: _LpInputs,
    battery: BatteryParams,
    E_initial: float | None = None,
    terminal_E: float | None = None,
) -> tuple[cp.Problem, dict[str, cp.Variable | cp.Expression]]:
    """Construct the LP. Returns (problem, dict of named variables / exprs).

    Variables: c[T], d[T], b_reg[T], E[T+1].
    """
    T = len(inputs.lmp)
    if T == 0:
        raise ValueError("Cannot build LP for empty horizon")

    c = cp.Variable(T, nonneg=True)
    d = cp.Variable(T, nonneg=True)
    b_reg = cp.Variable(T, nonneg=True)
    E = cp.Variable(T + 1)

    e0 = battery.E_initial if E_initial is None else float(E_initial)

    constraints = [
        c <= battery.P_max,
        d <= battery.P_max,
        c + d <= battery.P_max,
        b_reg + c + d <= battery.P_max,
        E[0] == e0,
        E >= 0.0,
        E <= battery.E_max,
    ]
    for t in range(T):
        constraints.append(
            E[t + 1]
            == E[t]
            + battery.eta_c * c[t] * inputs.dt_hours
            - d[t] * inputs.dt_hours / battery.eta_d
        )
    if terminal_E is not None:
        constraints.append(E[T] == float(terminal_E))

    energy_rev = cp.sum(cp.multiply(inputs.lmp, d - c)) * inputs.dt_hours
    reg_rev = (
        cp.sum(cp.multiply(inputs.reg_cap, b_reg)) * inputs.dt_hours
        + cp.sum(cp.multiply(inputs.reg_perf * inputs.rho, b_reg)) * inputs.dt_hours
    )
    deg_cost = battery.kappa * cp.sum(c + d) * inputs.dt_hours

    objective = cp.Maximize(energy_rev + reg_rev - deg_cost)
    problem = cp.Problem(objective, constraints)
    return problem, {
        "c": c,
        "d": d,
        "b_reg": b_reg,
        "E": E,
        "energy_rev": energy_rev,
        "reg_rev": reg_rev,
        "deg_cost": deg_cost,
    }


def _solve(problem: cp.Problem) -> float:
    """Solve with HiGHS, fall back to ECOS if HiGHS fails."""
    t0 = time.perf_counter()
    try:
        problem.solve(solver=cp.HIGHS)
    except (cp.error.SolverError, Exception):  # pragma: no cover
        problem.solve(solver=cp.ECOS)
    elapsed = time.perf_counter() - t0

    if problem.status not in {cp.OPTIMAL, cp.OPTIMAL_INACCURATE}:
        raise RuntimeError(f"LP did not solve to optimality: status={problem.status}")
    return elapsed


def _build_schedule(
    index: pd.DatetimeIndex,
    inputs: _LpInputs,
    battery: BatteryParams,
    c_val: np.ndarray,
    d_val: np.ndarray,
    b_reg_val: np.ndarray,
    E_val: np.ndarray,
) -> pd.DataFrame:
    dt = inputs.dt_hours
    energy_reward = inputs.lmp * (d_val - c_val) * dt
    reg_reward = (
        inputs.reg_cap * b_reg_val * dt
        + inputs.reg_perf * inputs.rho * b_reg_val * dt
    )
    deg = battery.kappa * (c_val + d_val) * dt
    reward = energy_reward + reg_reward - deg

    return pd.DataFrame(
        {
            "c_mw": c_val,
            "d_mw": d_val,
            "b_reg_mw": b_reg_val,
            "E_mwh": E_val[1:],         # SOC at end of each interval
            "lmp": inputs.lmp,
            "reward": reward,
        },
        index=index,
    )


def solve_perfect_foresight(
    lmps: pd.Series,
    reg_cap_prices: pd.Series,
    reg_perf_prices: pd.Series,
    battery: BatteryParams = DEFAULT_BATTERY,
    dt_hours: float = 5.0 / 60.0,
    rho_assumed: float = 0.95,
    policy_name: str = "perfect_foresight_lp",
) -> DispatchResult:
    """Solve the perfect-foresight LP and return a :class:`DispatchResult`."""
    index, inputs = _validate_and_align(
        lmps, reg_cap_prices, reg_perf_prices, dt_hours, rho_assumed
    )
    problem, vars_ = _build_problem(inputs, battery)
    elapsed = _solve(problem)

    c_val = np.asarray(vars_["c"].value, dtype=float)
    d_val = np.asarray(vars_["d"].value, dtype=float)
    b_reg_val = np.asarray(vars_["b_reg"].value, dtype=float)
    E_val = np.asarray(vars_["E"].value, dtype=float)

    schedule = _build_schedule(index, inputs, battery, c_val, d_val, b_reg_val, E_val)

    energy_revenue = float(np.sum(inputs.lmp * (d_val - c_val) * inputs.dt_hours))
    regulation_revenue = float(
        np.sum(inputs.reg_cap * b_reg_val * inputs.dt_hours)
        + np.sum(inputs.reg_perf * inputs.rho * b_reg_val * inputs.dt_hours)
    )
    degradation_cost = float(battery.kappa * np.sum(c_val + d_val) * inputs.dt_hours)
    total_revenue = energy_revenue + regulation_revenue - degradation_cost

    return DispatchResult(
        schedule=schedule,
        total_revenue=total_revenue,
        energy_revenue=energy_revenue,
        regulation_revenue=regulation_revenue,
        degradation_cost=degradation_cost,
        solve_time_seconds=elapsed,
        policy_name=policy_name,
    )
