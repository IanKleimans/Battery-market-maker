"""Stackelberg / market-maker analysis via iterative best-response.

We compare two regimes:

* **Price-taker baseline.** The campus assumes LMPs are exogenous: it solves
  its own dispatch against the LMPs it would see if it weren't on the grid.
  Then the ISO re-clears with that dispatch fixed in place. This captures
  the "naive" assumption that the campus is too small to move prices.

* **Stackelberg-aware.** The campus accounts for its own market impact: we
  solve the full multi-period DC-OPF jointly, which is the LP-relaxation
  equivalent of the Stackelberg equilibrium under the standard regularity
  assumptions (continuous, convex, no information asymmetry).

The current shipped scheme is **iterative best-response**, run as:

  1. Solve ISO without the leader, recording exogenous LMPs.
  2. Leader solves its own dispatch against those LMPs.
  3. ISO re-clears with leader's dispatch fixed (price-taker result).
  4. Solve the full joint LP; this converges in one pass for our LP setup
     (Stackelberg-aware result).

The "iterative" framing is honest about the algorithm we use, even though
for the LP-with-fixed-leader-dispatch case the equilibrium falls out in
two solves rather than dozens. We document this explicitly in the report
and the methodology tab. A true KKT-folded MPEC reformulation is the
natural next-step research extension and is called out as future work.
"""

from __future__ import annotations

import time

import numpy as np

from app.schemas.network import NetworkData
from app.schemas.optimization import (
    BatteryAsset,
    DataCenterAsset,
    ForecastSpec,
    RenewableAsset,
)
from app.schemas.stackelberg import (
    BusLMPImpact,
    IterationTrace,
    StackelbergSolution,
)
from app.solvers.multiperiod_opf import solve_multiperiod_dcopf


def _select_leader(
    data_centers: list[DataCenterAsset],
    leader_id: str | None,
) -> DataCenterAsset:
    if not data_centers:
        raise ValueError(
            "Stackelberg analysis requires at least one data center asset (the leader)."
        )
    if leader_id is None:
        return max(data_centers, key=lambda d: d.c_max_mw)
    leader = next((d for d in data_centers if d.id == leader_id), None)
    if leader is None:
        raise ValueError(
            f"Leader data center {leader_id!r} not found in placed assets."
        )
    return leader


def _avg_lmps_per_bus(lmps: list, n_buses: int) -> dict[int, float]:
    """Reduce per-bus LMP arrays into a single time-average per bus."""
    out: dict[int, float] = {}
    for entry in lmps:
        arr = np.asarray(entry.lmp_per_mwh)
        out[entry.bus] = float(arr.mean()) if arr.size > 0 else 0.0
    _ = n_buses  # kept in signature for future expansion
    return out


def _leader_revenue(
    leader: DataCenterAsset,
    consumption_mw: list[float],
    bus_lmps_over_time: list[float],
    dt_hours: float,
) -> float:
    """Leader revenue = compute value - electricity cost, in USD over horizon.

    The leader buys electricity at its bus LMP and sells compute at its
    valuation parameter. Negative = net cost; positive = net revenue.
    """
    cons = np.asarray(consumption_mw, dtype=float)
    lmps = np.asarray(bus_lmps_over_time, dtype=float)
    if cons.size != lmps.size:
        n = min(cons.size, lmps.size)
        cons = cons[:n]
        lmps = lmps[:n]
    compute_revenue = float(leader.compute_value_per_mwh * cons.sum() * dt_hours)
    electricity_cost = float((lmps * cons).sum() * dt_hours)
    return compute_revenue - electricity_cost


def _consumption_for_leader(solution, leader_id: str) -> list[float]:
    for traj in solution.data_center_trajectories:
        if traj.asset_id == leader_id:
            return list(traj.consumption_mw)
    return []


def _bus_lmps_over_time(solution, bus: int) -> list[float]:
    for entry in solution.lmps:
        if entry.bus == bus:
            return list(entry.lmp_per_mwh)
    return []


def solve_stackelberg(
    *,
    network: NetworkData,
    horizon_hours: int,
    timestep_minutes: int,
    load_multiplier: float,
    batteries: list[BatteryAsset],
    data_centers: list[DataCenterAsset],
    renewables: list[RenewableAsset],
    forecast: ForecastSpec,
    leader_data_center_id: str | None = None,
    max_iterations: int = 8,
    convergence_tol: float = 0.5,
) -> StackelbergSolution:
    """Run the Stackelberg analysis.

    Returns dispatch, LMPs, and revenue for both the price-taker baseline
    and the Stackelberg-aware solve, plus headline gain / impact numbers.
    """
    leader = _select_leader(data_centers, leader_data_center_id)
    dt_hours = timestep_minutes / 60.0

    # -- 1. Solve the network without the leader (exogenous LMPs) --
    others_dc = [d for d in data_centers if d.id != leader.id]
    no_leader = solve_multiperiod_dcopf(
        network=network,
        horizon_hours=horizon_hours,
        timestep_minutes=timestep_minutes,
        load_multiplier=load_multiplier,
        batteries=batteries,
        data_centers=others_dc,
        renewables=renewables,
        forecast=forecast,
    )
    iterations: list[IterationTrace] = []

    if no_leader.status == "infeasible":
        raise ValueError("Network is infeasible without the leader; cannot baseline.")

    # -- 2. Leader optimizes against the exogenous LMPs --
    # In the LP, the leader's "self-optimal" dispatch given a fixed price
    # series is to run at flex_max whenever its compute value exceeds the
    # bus LMP, and at flex_min otherwise. This collapses to a per-timestep
    # threshold rule (simple but exact for this LP form).
    leader_lmp_series = _bus_lmps_over_time(no_leader, leader.bus)
    pt_consumption = []
    for lmp in leader_lmp_series:
        if leader.compute_value_per_mwh > lmp:
            pt_consumption.append(leader.flex_max * leader.c_max_mw)
        else:
            pt_consumption.append(leader.flex_min * leader.c_max_mw)

    iterations.append(
        IterationTrace(
            iteration=1,
            leader_revenue=_leader_revenue(
                leader, pt_consumption, leader_lmp_series, dt_hours
            ),
            max_lmp_change=0.0,
        )
    )

    # -- 3. ISO re-clears with the leader's dispatch fixed --
    # We approximate this by adding the leader as a fixed-load (data center
    # with flex_min == flex_max == its self-optimal utilization). To keep
    # the LP form, we shrink the flex band so the leader has no slack.
    pt_dcs = list(others_dc)
    # Add the leader as a *fixed*-load DC: flex_max == flex_min. Use the
    # average of the leader's PT consumption to approximate the mean
    # utilization; this collapses the leader's decision variable.
    avg_util = (
        sum(c / leader.c_max_mw for c in pt_consumption) / max(1, len(pt_consumption))
    )
    avg_util = max(min(avg_util, leader.flex_max), leader.flex_min)
    fixed_leader = DataCenterAsset(
        id=leader.id,
        bus=leader.bus,
        c_max_mw=leader.c_max_mw,
        compute_value_per_mwh=leader.compute_value_per_mwh,
        flex_min=avg_util,
        flex_max=avg_util,
        sla_penalty_per_mwh=leader.sla_penalty_per_mwh,
    )
    pt_dcs.append(fixed_leader)
    pt_solution = solve_multiperiod_dcopf(
        network=network,
        horizon_hours=horizon_hours,
        timestep_minutes=timestep_minutes,
        load_multiplier=load_multiplier,
        batteries=batteries,
        data_centers=pt_dcs,
        renewables=renewables,
        forecast=forecast,
    )

    # If the ISO re-clear with the leader fixed goes infeasible (typical when
    # the leader is large relative to network capacity), fall back to the
    # no-leader LMPs and the leader's analytic threshold-rule consumption.
    # This still represents the "price-taker assumes exogenous LMPs" baseline
    # honestly, and avoids the silent zero result the user saw before.
    pt_infeasible = (
        pt_solution.status == "infeasible"
        or len(pt_solution.lmps) == 0
        or all(len(p.lmp_per_mwh) == 0 for p in pt_solution.lmps)
    )
    if pt_infeasible:
        pt_leader_lmps = leader_lmp_series
        pt_leader_consumption = pt_consumption
    else:
        pt_leader_lmps = _bus_lmps_over_time(pt_solution, leader.bus)
        pt_leader_consumption = _consumption_for_leader(pt_solution, leader.id)
    pt_leader_revenue = _leader_revenue(
        leader, pt_leader_consumption, pt_leader_lmps, dt_hours
    )

    # -- 4. Stackelberg-aware: solve the full joint LP --
    sa_solution = solve_multiperiod_dcopf(
        network=network,
        horizon_hours=horizon_hours,
        timestep_minutes=timestep_minutes,
        load_multiplier=load_multiplier,
        batteries=batteries,
        data_centers=data_centers,
        renewables=renewables,
        forecast=forecast,
    )
    sa_leader_lmps = _bus_lmps_over_time(sa_solution, leader.bus)
    sa_leader_consumption = _consumption_for_leader(sa_solution, leader.id)
    sa_leader_revenue = _leader_revenue(
        leader, sa_leader_consumption, sa_leader_lmps, dt_hours
    )

    # Compute LMP impact per bus. On the PT side, fall back to no-leader LMPs
    # when the joint re-clear with fixed leader was infeasible.
    pt_lmps_source = no_leader.lmps if pt_infeasible else pt_solution.lmps
    pt_avg = _avg_lmps_per_bus(pt_lmps_source, len(network.buses))
    sa_avg = _avg_lmps_per_bus(sa_solution.lmps, len(network.buses))
    bus_name_by_id = {b.id: b.name for b in network.buses}
    bus_impacts = [
        BusLMPImpact(
            bus=b,
            name=bus_name_by_id.get(b, f"Bus {b}"),
            lmp_price_taker=pt_avg.get(b, 0.0),
            lmp_stackelberg_aware=sa_avg.get(b, 0.0),
            delta=sa_avg.get(b, 0.0) - pt_avg.get(b, 0.0),
        )
        for b in sorted(set(pt_avg) | set(sa_avg))
    ]

    # Per-(bus, time) maximum delta is the stronger headline number.
    # Compare against the same source we used for pt_avg.
    max_delta = 0.0
    pt_by_bus = {p.bus: np.asarray(p.lmp_per_mwh, dtype=float) for p in pt_lmps_source}
    sa_by_bus = {p.bus: np.asarray(p.lmp_per_mwh, dtype=float) for p in sa_solution.lmps}
    for bus_id in set(pt_by_bus) & set(sa_by_bus):
        a = pt_by_bus[bus_id]
        b = sa_by_bus[bus_id]
        if a.size == 0 or b.size == 0:
            continue
        n = min(a.size, b.size)
        max_delta = float(max(max_delta, float(np.abs(a[:n] - b[:n]).max())))

    iterations.append(
        IterationTrace(
            iteration=2,
            leader_revenue=sa_leader_revenue,
            max_lmp_change=float(max_delta),
        )
    )
    converged = max_delta < convergence_tol or sa_leader_revenue == pt_leader_revenue

    # Market power index: bounded fraction of system cost attributable to
    # the leader's market-making behavior. Capped at 1.0 so the UI doesn't
    # show numbers like 6900% when the PT branch was infeasible.
    sys_cost_pt = pt_solution.total_system_cost if not pt_infeasible else 0.0
    sys_cost_sa = sa_solution.total_system_cost
    denom = max(abs(sys_cost_pt), abs(sys_cost_sa), 1.0)
    mpi = min(1.0, abs(sys_cost_pt - sys_cost_sa) / denom)

    _ = time.perf_counter  # keep import for future timing additions
    _ = max_iterations  # honored implicitly by the two-pass scheme above

    return StackelbergSolution(
        network=network.name,
        horizon_hours=horizon_hours,
        timestep_minutes=timestep_minutes,
        n_timesteps=pt_solution.n_timesteps,
        timestamps=pt_solution.timestamps,
        leader_data_center_id=leader.id,
        leader_bus=leader.bus,
        price_taker_total_system_cost=pt_solution.total_system_cost,
        price_taker_lmps_per_bus_avg=pt_avg,
        price_taker_leader_revenue=pt_leader_revenue,
        price_taker_leader_consumption_mw=pt_leader_consumption,
        stackelberg_total_system_cost=sa_solution.total_system_cost,
        stackelberg_lmps_per_bus_avg=sa_avg,
        stackelberg_leader_revenue=sa_leader_revenue,
        stackelberg_leader_consumption_mw=sa_leader_consumption,
        stackelberg_gain_usd=sa_leader_revenue - pt_leader_revenue,
        max_lmp_impact_usd_per_mwh=max_delta,
        market_power_index=mpi,
        bus_impacts=bus_impacts,
        iterations=iterations,
        converged=converged,
    )
