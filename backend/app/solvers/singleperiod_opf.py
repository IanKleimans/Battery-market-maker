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
from app.schemas.optimization import GenOverride, SinglePeriodSolution, SolverStats


def solve_single_period(
    network: NetworkData,
    load_multiplier: float = 1.0,
    wind_availability: float = 1.0,
    line_capacity_overrides: dict[int, float] | None = None,
    line_outages: list[int] | None = None,
    load_overrides: dict[int, float] | None = None,
    gen_overrides: dict[int, GenOverride] | None = None,
) -> SinglePeriodSolution:
    overrides = line_capacity_overrides or {}
    outages = set(line_outages or [])
    load_o = load_overrides or {}
    gen_o = gen_overrides or {}
    n_bus = len(network.buses)
    n_gen = len(network.generators)
    n_line = len(network.lines)
    bus_index = {b.id: i for i, b in enumerate(network.buses)}
    slack_idx = next(i for i, b in enumerate(network.buses) if b.is_slack)

    # Per-generator nameplate capacity, optionally overridden / forced offline.
    # Wind also derates by the global wind_availability slider.
    def _gcap(g: object) -> float:
        ov = gen_o.get(g.id)  # type: ignore[attr-defined]
        if ov is not None and not ov.online:
            return 0.0
        cap = (
            ov.capacity_mw
            if (ov is not None and ov.capacity_mw is not None)
            else g.capacity_mw  # type: ignore[attr-defined]
        )
        if g.fuel == "wind":  # type: ignore[attr-defined]
            cap *= wind_availability
        return float(cap)

    def _gcost(g: object) -> float:
        ov = gen_o.get(g.id)  # type: ignore[attr-defined]
        if ov is not None and ov.cost_per_mwh is not None:
            return float(ov.cost_per_mwh)
        return float(g.cost_per_mwh)  # type: ignore[attr-defined]

    g_max = np.array([_gcap(g) for g in network.generators])
    g_min = np.array(
        [
            min(g.min_output_mw, _gcap(g))  # forced-offline gens collapse min to 0
            for g in network.generators
        ]
    )
    g_cost = np.array([_gcost(g) for g in network.generators])

    # Line capacity: outage forces 0; explicit override wins; else nameplate.
    cap_line = np.array(
        [
            0.0 if ln.id in outages else float(overrides.get(ln.id, ln.capacity_mva))
            for ln in network.lines
        ]
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

    # Loads: per-bus override (if provided) replaces the default profile;
    # otherwise the nameplate peak * 0.7 (mid-day) * load_multiplier applies.
    load_per_bus = np.zeros(n_bus)
    seen_buses: set[int] = set()
    for ld in network.loads:
        bi = bus_index[ld.bus]
        if ld.bus in load_o:
            if ld.bus not in seen_buses:
                load_per_bus[bi] = float(load_o[ld.bus])
                seen_buses.add(ld.bus)
        else:
            load_per_bus[bi] += ld.peak_mw * 0.7 * load_multiplier

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

    n_variables = int(problem.size_metrics.num_scalar_variables)
    n_constraints = int(problem.size_metrics.num_scalar_eq_constr) + int(
        problem.size_metrics.num_scalar_leq_constr
    )

    solver_used = "HIGHS"
    t0 = time.perf_counter()
    try:
        problem.solve(solver=cp.HIGHS)
    except Exception:
        problem.solve(solver=cp.ECOS)
        solver_used = "ECOS"
    elapsed = time.perf_counter() - t0

    stats = SolverStats(solver=solver_used, n_variables=n_variables, n_constraints=n_constraints)

    if problem.status not in {cp.OPTIMAL, cp.OPTIMAL_INACCURATE}:
        # Never put `inf`/`nan` on the wire: JSON has no Infinity, and downstream
        # JS treats `null` as falsy in some places and 0 in others. Surface
        # infeasibility through `status` instead and use 0.0 as a placeholder.
        return SinglePeriodSolution(
            status="infeasible",
            total_cost=0.0,
            solve_time_seconds=elapsed,
            generator_output={g.id: 0.0 for g in network.generators},
            line_flow={ln.id: 0.0 for ln in network.lines},
            line_utilization={ln.id: 0.0 for ln in network.lines},
            bus_lmp={b.id: 0.0 for b in network.buses},
            bus_load={b.id: float(load_per_bus[bi]) for bi, b in enumerate(network.buses)},
            solver_stats=stats,
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
        solver_stats=stats,
    )
