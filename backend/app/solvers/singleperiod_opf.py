"""Single-period DC-OPF used for Live mode (slider-driven).

This is the simplest possible DC economic dispatch: minimise generator cost
subject to flow + capacity + balance, returning per-bus LMPs from the duals.
Also supports overriding line capacities, scaling load, and partially derating
wind generators (for the Live-mode wind-availability slider).
"""

from __future__ import annotations

import time

import cvxpy as cp
import numpy as np

from app.schemas.network import NetworkData
from app.schemas.optimization import SinglePeriodSolution


def solve_single_period(
    network: NetworkData,
    load_multiplier: float = 1.0,
    wind_availability: float = 1.0,
    line_capacity_overrides: dict[int, float] | None = None,
) -> SinglePeriodSolution:
    overrides = line_capacity_overrides or {}
    n_bus = len(network.buses)
    n_gen = len(network.generators)
    n_line = len(network.lines)
    bus_index = {b.id: i for i, b in enumerate(network.buses)}
    slack_idx = next(i for i, b in enumerate(network.buses) if b.is_slack)

    # Effective gen capacity: derate wind generators by wind_availability.
    g_max = np.array(
        [
            (g.capacity_mw * wind_availability if g.fuel == "wind" else g.capacity_mw)
            for g in network.generators
        ]
    )
    g_min = np.array([g.min_output_mw for g in network.generators])
    g_cost = np.array([g.cost_per_mwh for g in network.generators])

    cap_line = np.array(
        [overrides.get(ln.id, ln.capacity_mva) for ln in network.lines]
    )
    x_line = np.array([ln.reactance for ln in network.lines])
    line_from = np.array([bus_index[ln.from_bus] for ln in network.lines])
    line_to = np.array([bus_index[ln.to_bus] for ln in network.lines])

    P_g = cp.Variable(n_gen)
    theta = cp.Variable(n_bus)
    f = cp.Variable(n_line)

    constraints = [
        P_g >= g_min,
        P_g <= g_max,
        f == (theta[line_from] - theta[line_to]) / x_line,
        f >= -cap_line,
        f <= cap_line,
        theta[slack_idx] == 0,
    ]

    # Loads — peak * 0.7 default (mid-day equivalent), modified by multiplier
    load_per_bus = np.zeros(n_bus)
    for ld in network.loads:
        load_per_bus[bus_index[ld.bus]] += ld.peak_mw * 0.7 * load_multiplier

    # Move all variables to LHS so the constraint canonicalises identically at
    # every bus: ``net_injection(x) == load`` with the constant load on the RHS.
    # Under this form, cvxpy's HiGHS dual satisfies ``LMP = -dual_value`` at every bus.
    nodal_balance: list[cp.Constraint] = []
    for b_idx in range(n_bus):
        gen_terms = [P_g[gi] for gi, g in enumerate(network.generators) if bus_index[g.bus] == b_idx]
        from_lines = [li for li, ln in enumerate(network.lines) if bus_index[ln.from_bus] == b_idx]
        to_lines = [li for li, ln in enumerate(network.lines) if bus_index[ln.to_bus] == b_idx]
        gen_sum = cp.sum(gen_terms) if gen_terms else 0
        out_sum = cp.sum([f[li] for li in from_lines]) if from_lines else 0
        in_sum = cp.sum([f[li] for li in to_lines]) if to_lines else 0
        # net injection at bus = gen - net_outflow, must equal load
        con = gen_sum - out_sum + in_sum == load_per_bus[b_idx]
        nodal_balance.append(con)
    constraints.extend(nodal_balance)

    objective = cp.Minimize(cp.sum(cp.multiply(P_g, g_cost)))
    problem = cp.Problem(objective, constraints)

    t0 = time.perf_counter()
    try:
        problem.solve(solver=cp.HIGHS)
    except Exception:
        problem.solve(solver=cp.ECOS)
    elapsed = time.perf_counter() - t0

    if problem.status not in {cp.OPTIMAL, cp.OPTIMAL_INACCURATE}:
        return SinglePeriodSolution(
            status="infeasible",
            total_cost=float("inf"),
            solve_time_seconds=elapsed,
            generator_output={},
            line_flow={},
            line_utilization={},
            bus_lmp={},
            bus_load={ld.bus: load_per_bus[bus_index[ld.bus]] for ld in network.loads},
        )

    P_g_v = np.asarray(P_g.value, dtype=float)
    f_v = np.asarray(f.value, dtype=float)
    util = np.abs(f_v) / np.where(cap_line > 0, cap_line, 1.0)

    # See multiperiod_opf._extract_lmps for the sign convention.
    lmp = np.zeros(n_bus)
    for b_idx, con in enumerate(nodal_balance):
        if con.dual_value is not None:
            lmp[b_idx] = -float(con.dual_value)

    return SinglePeriodSolution(
        status="optimal" if problem.status == cp.OPTIMAL else "optimal_inaccurate",
        total_cost=float(problem.value),
        solve_time_seconds=elapsed,
        generator_output={g.id: float(P_g_v[gi]) for gi, g in enumerate(network.generators)},
        line_flow={ln.id: float(f_v[li]) for li, ln in enumerate(network.lines)},
        line_utilization={ln.id: float(util[li]) for li, ln in enumerate(network.lines)},
        bus_lmp={b.id: float(lmp[bi]) for bi, b in enumerate(network.buses)},
        bus_load={b.id: float(load_per_bus[bi]) for bi, b in enumerate(network.buses)},
    )
