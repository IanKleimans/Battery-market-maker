"""Multi-period DC-OPF with batteries, flexible data centers, and renewables.

Formulation
-----------
Let ``T`` = number of timesteps, ``B`` = buses, ``L`` = lines, ``G`` = generators,
plus assets indexed separately.

Variables
~~~~~~~~~
* ``P_g[t, g]`` — generator dispatch (MW), ``0 <= P_g <= P_max``
* ``theta[t, b]`` — bus voltage angle (rad), with ``theta[:, slack] = 0``
* ``f[t, l]`` — line flow (MW), ``f = (theta_from - theta_to) / x``
* ``c[t, k], d[t, k]`` — battery charge / discharge (MW), ``>= 0``
* ``E[t, k]`` — battery state of charge (MWh)
* ``u[t, j]`` — data-center utilisation, ``flex_min <= u <= flex_max``
* ``curtail[t, r]`` — renewable curtailment fraction, ``0 <= curtail <= 1``

Constraints
~~~~~~~~~~~
* DC power flow: ``f[t,l] = (theta[t,from(l)] - theta[t,to(l)]) / x_l``
* Line capacity: ``-cap_l <= f[t,l] <= cap_l``
* Generator capacity: ``min_g <= P_g[t,g] <= cap_g``
* Slack: ``theta[t, slack] = 0``
* Nodal balance at each bus, each timestep::

      sum_{g at b} P_g[t,g]
      + sum_{r at b} (1 - curtail[t,r]) * available_r[t]
      + sum_{k at b} (d[t,k] - c[t,k])
      - load_b[t]
      - sum_{j at b} c_max_j * u[t,j]
      = sum_{l: from=b} f[t,l] - sum_{l: to=b} f[t,l]

* SOC dynamics: ``E[t+1,k] = E[t,k] + eta_c * c[t,k] * dt - d[t,k] * dt / eta_d``
* SOC bounds: ``0 <= E <= E_max``; ``E[0] = E_initial``
* Single-direction (soft): ``c + d <= P_max`` (degradation cost ``kappa`` makes
  simultaneous charge/discharge strictly suboptimal whenever ``kappa > 0``)

Objective
~~~~~~~~~
Minimise total system cost::

    sum_t [ sum_g cost_g * P_g[t,g] * dt
          + sum_k kappa_k * (c + d) * dt
          + sum_r curt_pen_r * curtail[t,r] * available_r[t] * dt
          + sum_j sla_j * (1 - u[t,j]) * c_max_j * dt
          - sum_j v_j * u[t,j] * c_max_j * dt ]

LMPs are recovered from the **dual variables** of the nodal-balance constraints.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import cvxpy as cp
import numpy as np

from app.schemas.network import NetworkData
from app.schemas.optimization import (
    BatteryAsset,
    BatteryTrajectory,
    DataCenterAsset,
    DataCenterTrajectory,
    ForecastSpec,
    GenDispatchPoint,
    LineFlowPoint,
    LMPPoint,
    MultiPeriodSolution,
    RenewableAsset,
    RenewableTrajectory,
    RevenueBreakdown,
)
from app.solvers.forecasts import (
    hours_grid,
    load_profile,
    perturb,
    solar_profile,
    wind_profile,
)


@dataclass
class _BuildArtifacts:
    """Internal: things we keep around after building the problem."""

    problem: cp.Problem
    P_g: cp.Variable
    theta: cp.Variable
    f: cp.Variable
    c: cp.Variable | None
    d: cp.Variable | None
    E: cp.Variable | None
    u: cp.Variable | None
    curtail: cp.Variable | None
    nodal_balance: list[cp.Constraint]  # T*B constraints, in (t, b) order
    available_renew: np.ndarray  # shape (T, R) — MW after forecast
    load_mw: np.ndarray  # shape (T, B) — MW per bus per timestep
    timestamps: list[str]
    T: int


def _build_load_matrix(
    network: NetworkData,
    horizon_hours: int,
    timestep_minutes: int,
    load_multiplier: float,
) -> np.ndarray:
    """Per-bus load (MW) at each timestep."""
    n_t = (horizon_hours * 60) // timestep_minutes
    bus_index = {b.id: i for i, b in enumerate(network.buses)}
    load = np.zeros((n_t, len(network.buses)))
    for ld in network.loads:
        prof = load_profile(ld.profile_type, horizon_hours, timestep_minutes)
        load[:, bus_index[ld.bus]] += prof * ld.peak_mw * load_multiplier
    return load


def _renewable_availability(
    renewables: list[RenewableAsset],
    horizon_hours: int,
    timestep_minutes: int,
    forecast: ForecastSpec,
) -> np.ndarray:
    """MW available per timestep per renewable asset (post-forecast-error)."""
    n_t = (horizon_hours * 60) // timestep_minutes
    out = np.zeros((n_t, len(renewables)))
    for j, r in enumerate(renewables):
        if r.kind == "solar":
            truth = solar_profile(horizon_hours, timestep_minutes, seed=forecast.seed)
        else:
            truth = wind_profile(horizon_hours, timestep_minutes, seed=forecast.seed)
        forecast_pu = perturb(truth, forecast.source, seed=forecast.seed)
        out[:, j] = forecast_pu * r.capacity_mw
    return out


def _timestamps(horizon_hours: int, timestep_minutes: int) -> list[str]:
    """Generate ISO timestamps starting at 2024-01-01T00:00 in UTC."""
    import pandas as pd

    n_t = (horizon_hours * 60) // timestep_minutes
    idx = pd.date_range(
        start="2024-01-01T00:00:00Z", periods=n_t, freq=f"{timestep_minutes}min"
    )
    return [t.isoformat() for t in idx]


def _build_problem(
    network: NetworkData,
    horizon_hours: int,
    timestep_minutes: int,
    load_multiplier: float,
    batteries: list[BatteryAsset],
    data_centers: list[DataCenterAsset],
    renewables: list[RenewableAsset],
    forecast: ForecastSpec,
) -> _BuildArtifacts:
    dt = timestep_minutes / 60.0
    n_t = (horizon_hours * 60) // timestep_minutes
    timestamps = _timestamps(horizon_hours, timestep_minutes)

    bus_index = {b.id: i for i, b in enumerate(network.buses)}
    n_bus = len(network.buses)
    n_gen = len(network.generators)
    n_line = len(network.lines)
    slack_idx = next(i for i, b in enumerate(network.buses) if b.is_slack)

    # ----- Variables -----
    P_g = cp.Variable((n_t, n_gen), name="P_g")
    theta = cp.Variable((n_t, n_bus), name="theta")
    f = cp.Variable((n_t, n_line), name="f")

    # Generator output bounds
    g_max = np.array([g.capacity_mw for g in network.generators])
    g_min = np.array([g.min_output_mw for g in network.generators])
    g_cost = np.array([g.cost_per_mwh for g in network.generators])

    # Line params
    x_line = np.array([ln.reactance for ln in network.lines])
    cap_line = np.array([ln.capacity_mva for ln in network.lines])
    line_from = np.array([bus_index[ln.from_bus] for ln in network.lines])
    line_to = np.array([bus_index[ln.to_bus] for ln in network.lines])

    constraints: list[cp.Constraint] = []
    constraints.append(P_g >= np.tile(g_min, (n_t, 1)))
    constraints.append(P_g <= np.tile(g_max, (n_t, 1)))

    # DC flow: f = (theta_from - theta_to) / x  — broadcast over t
    constraints.append(f == (theta[:, line_from] - theta[:, line_to]) / x_line)
    constraints.append(f >= -cap_line)
    constraints.append(f <= cap_line)

    # Slack bus
    constraints.append(theta[:, slack_idx] == 0)

    # Battery vars
    n_bat = len(batteries)
    if n_bat > 0:
        c = cp.Variable((n_t, n_bat), nonneg=True, name="charge")
        d = cp.Variable((n_t, n_bat), nonneg=True, name="discharge")
        E = cp.Variable((n_t + 1, n_bat), nonneg=True, name="soc")
        bat_p_max = np.array([b.p_max_mw for b in batteries])
        bat_e_max = np.array([b.e_max_mwh for b in batteries])
        bat_eta_c = np.array([b.eta_c for b in batteries])
        bat_eta_d = np.array([b.eta_d for b in batteries])
        bat_kappa = np.array([b.kappa for b in batteries])
        bat_E0 = np.array([b.initial_soc_mwh for b in batteries])
        constraints.append(c <= bat_p_max)
        constraints.append(d <= bat_p_max)
        constraints.append(c + d <= bat_p_max)
        constraints.append(E <= bat_e_max)
        constraints.append(E[0] == bat_E0)
        # SOC transition (vectorised over t and assets)
        constraints.append(
            E[1:] == E[:-1] + cp.multiply(c, bat_eta_c) * dt - cp.multiply(d, 1.0 / bat_eta_d) * dt
        )
    else:
        c = d = E = None
        bat_kappa = np.array([])

    # Data-center vars
    n_dc = len(data_centers)
    if n_dc > 0:
        u = cp.Variable((n_t, n_dc), name="u")
        dc_min = np.array([j.flex_min for j in data_centers])
        dc_max = np.array([j.flex_max for j in data_centers])
        dc_cmax = np.array([j.c_max_mw for j in data_centers])
        dc_value = np.array([j.compute_value_per_mwh for j in data_centers])
        dc_sla = np.array([j.sla_penalty_per_mwh for j in data_centers])
        constraints.append(u >= dc_min)
        constraints.append(u <= dc_max)
    else:
        u = None
        dc_cmax = np.array([])
        dc_value = np.array([])
        dc_sla = np.array([])

    # Renewable vars
    n_renew = len(renewables)
    available_renew = _renewable_availability(renewables, horizon_hours, timestep_minutes, forecast)
    if n_renew > 0:
        curtail = cp.Variable((n_t, n_renew), name="curtail")
        constraints.append(curtail >= 0)
        constraints.append(curtail <= 1)
        renew_pen = np.array([r.curtailment_penalty_per_mwh for r in renewables])
    else:
        curtail = None
        renew_pen = np.array([])

    # Loads
    load_mw = _build_load_matrix(network, horizon_hours, timestep_minutes, load_multiplier)

    # ----- Nodal balance (one constraint per (t, b) for LMP recovery) -----
    nodal_constraints: list[cp.Constraint] = []
    gen_at_bus: list[list[int]] = [[] for _ in range(n_bus)]
    for gi, g in enumerate(network.generators):
        gen_at_bus[bus_index[g.bus]].append(gi)
    bat_at_bus: list[list[int]] = [[] for _ in range(n_bus)]
    for bi, b in enumerate(batteries):
        bat_at_bus[bus_index[b.bus]].append(bi)
    dc_at_bus: list[list[int]] = [[] for _ in range(n_bus)]
    for ji, j in enumerate(data_centers):
        dc_at_bus[bus_index[j.bus]].append(ji)
    renew_at_bus: list[list[int]] = [[] for _ in range(n_bus)]
    for ri, r in enumerate(renewables):
        renew_at_bus[bus_index[r.bus]].append(ri)
    line_from_at_bus: list[list[int]] = [[] for _ in range(n_bus)]
    line_to_at_bus: list[list[int]] = [[] for _ in range(n_bus)]
    for li, ln in enumerate(network.lines):
        line_from_at_bus[bus_index[ln.from_bus]].append(li)
        line_to_at_bus[bus_index[ln.to_bus]].append(li)

    # Move all variables to LHS so the constraint canonicalises consistently at
    # every (t, bus) — see _extract_lmps for the resulting sign convention.
    for t in range(n_t):
        for b_idx in range(n_bus):
            lhs_terms: list[cp.Expression] = []
            for gi in gen_at_bus[b_idx]:
                lhs_terms.append(P_g[t, gi])
            for bi in bat_at_bus[b_idx]:
                assert d is not None and c is not None
                lhs_terms.append(d[t, bi] - c[t, bi])
            for ji in dc_at_bus[b_idx]:
                assert u is not None
                lhs_terms.append(-u[t, ji] * dc_cmax[ji])
            for ri in renew_at_bus[b_idx]:
                assert curtail is not None
                lhs_terms.append((1 - curtail[t, ri]) * available_renew[t, ri])
            inflow_lhs = cp.sum(lhs_terms) if lhs_terms else 0
            out_terms = [f[t, li] for li in line_from_at_bus[b_idx]]
            in_terms = [f[t, li] for li in line_to_at_bus[b_idx]]
            out_sum = cp.sum(out_terms) if out_terms else 0
            in_sum = cp.sum(in_terms) if in_terms else 0
            # net injection - net outflow == load
            con = inflow_lhs - out_sum + in_sum == load_mw[t, b_idx]
            nodal_constraints.append(con)

    constraints.extend(nodal_constraints)

    # ----- Objective -----
    gen_cost = cp.sum(cp.multiply(P_g, g_cost)) * dt
    obj_terms: list[cp.Expression] = [gen_cost]
    if n_bat > 0:
        assert c is not None and d is not None
        deg = cp.sum(cp.multiply(c + d, bat_kappa)) * dt
        obj_terms.append(deg)
    if n_renew > 0:
        assert curtail is not None
        # curt_cost = sum_t sum_r curtailment_penalty * curtail * available
        curt_cost = cp.sum(cp.multiply(cp.multiply(curtail, available_renew), renew_pen)) * dt
        obj_terms.append(curt_cost)
    if n_dc > 0:
        assert u is not None
        # SLA penalty for any unmet utilisation (relative to flex_max)
        unmet = cp.multiply(dc_max - u, dc_cmax)
        obj_terms.append(cp.sum(cp.multiply(unmet, dc_sla)) * dt)
        # Compute value (negative cost — value of running the DC)
        served = cp.multiply(u, dc_cmax)
        obj_terms.append(-cp.sum(cp.multiply(served, dc_value)) * dt)

    objective = cp.Minimize(cp.sum(obj_terms))
    problem = cp.Problem(objective, constraints)

    return _BuildArtifacts(
        problem=problem,
        P_g=P_g,
        theta=theta,
        f=f,
        c=c,
        d=d,
        E=E,
        u=u,
        curtail=curtail,
        nodal_balance=nodal_constraints,
        available_renew=available_renew,
        load_mw=load_mw,
        timestamps=timestamps,
        T=n_t,
    )


def _solve(problem: cp.Problem) -> tuple[float, str]:
    """Solve with HiGHS, falling back to ECOS. Returns (elapsed, status)."""
    t0 = time.perf_counter()
    try:
        problem.solve(solver=cp.HIGHS)
    except Exception:
        problem.solve(solver=cp.ECOS)
    elapsed = time.perf_counter() - t0
    status = problem.status
    if status == cp.OPTIMAL:
        normalised = "optimal"
    elif status == cp.OPTIMAL_INACCURATE:
        normalised = "optimal_inaccurate"
    else:
        normalised = "infeasible"
    return elapsed, normalised


def _extract_lmps(
    nodal_balance: list[cp.Constraint],
    n_t: int,
    n_bus: int,
    dt: float,
) -> np.ndarray:
    """LMPs from the nodal balance duals.

    The objective is in $/period (cost * P * dt), so the dual on the nodal
    balance (RHS in MW) carries units $/MW = $/MW. Dividing by ``dt`` yields
    the more conventional $/MWh price.

    Returns array shape (n_t, n_bus).
    """
    # cvxpy reports the dual of `lhs == rhs` with the sign convention
    # `L = f(x) + mu * (lhs - rhs)`.  Our balance is written as
    # `gen_sum - load == out - in`, so the LMP (sensitivity of cost to load)
    # equals `-mu` divided by dt to convert from $/MW-period to $/MWh.
    lmps = np.zeros((n_t, n_bus))
    for k, con in enumerate(nodal_balance):
        t = k // n_bus
        b = k % n_bus
        dv = con.dual_value
        if dv is None:
            continue
        lmps[t, b] = -float(dv) / dt
    return lmps


def solve_multiperiod_dcopf(
    network: NetworkData,
    horizon_hours: int,
    timestep_minutes: int,
    load_multiplier: float = 1.0,
    batteries: list[BatteryAsset] | None = None,
    data_centers: list[DataCenterAsset] | None = None,
    renewables: list[RenewableAsset] | None = None,
    forecast: ForecastSpec | None = None,
) -> MultiPeriodSolution:
    """Solve and package results."""
    batteries = batteries or []
    data_centers = data_centers or []
    renewables = renewables or []
    forecast = forecast or ForecastSpec()
    dt = timestep_minutes / 60.0

    art = _build_problem(
        network=network,
        horizon_hours=horizon_hours,
        timestep_minutes=timestep_minutes,
        load_multiplier=load_multiplier,
        batteries=batteries,
        data_centers=data_centers,
        renewables=renewables,
        forecast=forecast,
    )
    elapsed, status = _solve(art.problem)

    if status == "infeasible":
        return MultiPeriodSolution(
            status="infeasible",
            horizon_hours=horizon_hours,
            timestep_minutes=timestep_minutes,
            n_timesteps=art.T,
            timestamps=art.timestamps,
            total_system_cost=float("inf"),
            solve_time_seconds=elapsed,
            generator_dispatch=[],
            line_flows=[],
            lmps=[],
            battery_trajectories=[],
            data_center_trajectories=[],
            renewable_trajectories=[],
            revenue=[],
        )

    # Extract values
    P_g_v = np.asarray(art.P_g.value, dtype=float)
    f_v = np.asarray(art.f.value, dtype=float)
    cap_line = np.array([ln.capacity_mva for ln in network.lines])
    util = np.abs(f_v) / cap_line[None, :]

    lmps_arr = _extract_lmps(art.nodal_balance, art.T, len(network.buses), dt)

    gen_disp = [
        GenDispatchPoint(gen_id=g.id, p_mw=P_g_v[:, gi].tolist())
        for gi, g in enumerate(network.generators)
    ]
    line_flows = [
        LineFlowPoint(
            line_id=ln.id,
            flow_mw=f_v[:, li].tolist(),
            utilization=util[:, li].tolist(),
        )
        for li, ln in enumerate(network.lines)
    ]
    lmp_points = [
        LMPPoint(bus=b.id, lmp_per_mwh=lmps_arr[:, bi].tolist())
        for bi, b in enumerate(network.buses)
    ]

    bat_traj: list[BatteryTrajectory] = []
    bat_revs: list[RevenueBreakdown] = []
    if batteries and art.c is not None and art.d is not None and art.E is not None:
        c_v = np.asarray(art.c.value, dtype=float)
        d_v = np.asarray(art.d.value, dtype=float)
        E_v = np.asarray(art.E.value, dtype=float)
        bus_index = {b.id: i for i, b in enumerate(network.buses)}
        for bi, bat in enumerate(batteries):
            bat_traj.append(
                BatteryTrajectory(
                    asset_id=bat.id,
                    soc_mwh=E_v[1:, bi].tolist(),
                    charge_mw=c_v[:, bi].tolist(),
                    discharge_mw=d_v[:, bi].tolist(),
                )
            )
            # Revenue at the bus's LMP (positive when discharging)
            bus_lmp = lmps_arr[:, bus_index[bat.bus]]
            energy_rev = float(np.sum(bus_lmp * (d_v[:, bi] - c_v[:, bi]) * dt))
            deg = float(bat.kappa * np.sum(c_v[:, bi] + d_v[:, bi]) * dt)
            total = energy_rev - deg
            bat_revs.append(
                RevenueBreakdown(
                    asset_id=bat.id,
                    asset_kind="battery",
                    energy_revenue=energy_rev,
                    degradation_cost=deg,
                    total=total,
                )
            )

    dc_traj: list[DataCenterTrajectory] = []
    dc_revs: list[RevenueBreakdown] = []
    if data_centers and art.u is not None:
        u_v = np.asarray(art.u.value, dtype=float)
        bus_index = {b.id: i for i, b in enumerate(network.buses)}
        for ji, dc in enumerate(data_centers):
            consumption = u_v[:, ji] * dc.c_max_mw
            dc_traj.append(
                DataCenterTrajectory(
                    asset_id=dc.id,
                    utilization=u_v[:, ji].tolist(),
                    consumption_mw=consumption.tolist(),
                )
            )
            bus_lmp = lmps_arr[:, bus_index[dc.bus]]
            compute_rev = float(np.sum(consumption * dc.compute_value_per_mwh) * dt)
            energy_cost = float(np.sum(bus_lmp * consumption) * dt)
            unmet = (dc.flex_max - u_v[:, ji]) * dc.c_max_mw
            sla = float(np.sum(unmet * dc.sla_penalty_per_mwh) * dt)
            total = compute_rev - energy_cost - sla
            dc_revs.append(
                RevenueBreakdown(
                    asset_id=dc.id,
                    asset_kind="data_center",
                    compute_revenue=compute_rev,
                    energy_revenue=-energy_cost,
                    sla_penalty=sla,
                    total=total,
                )
            )

    renew_traj: list[RenewableTrajectory] = []
    renew_revs: list[RevenueBreakdown] = []
    if renewables and art.curtail is not None:
        curt_v = np.asarray(art.curtail.value, dtype=float)
        bus_index = {b.id: i for i, b in enumerate(network.buses)}
        for ri, r in enumerate(renewables):
            available = art.available_renew[:, ri]
            delivered = (1 - curt_v[:, ri]) * available
            curtailment = curt_v[:, ri] * available
            renew_traj.append(
                RenewableTrajectory(
                    asset_id=r.id,
                    available_mw=available.tolist(),
                    delivered_mw=delivered.tolist(),
                    curtailment_mw=curtailment.tolist(),
                )
            )
            bus_lmp = lmps_arr[:, bus_index[r.bus]]
            energy_rev = float(np.sum(bus_lmp * delivered) * dt)
            curt_pen = float(np.sum(curtailment) * dt * r.curtailment_penalty_per_mwh)
            total = energy_rev - curt_pen
            renew_revs.append(
                RevenueBreakdown(
                    asset_id=r.id,
                    asset_kind="renewable",
                    energy_revenue=energy_rev,
                    curtailment_penalty=curt_pen,
                    total=total,
                )
            )

    return MultiPeriodSolution(
        status=status,  # type: ignore[arg-type]
        horizon_hours=horizon_hours,
        timestep_minutes=timestep_minutes,
        n_timesteps=art.T,
        timestamps=art.timestamps,
        total_system_cost=float(art.problem.value),
        solve_time_seconds=elapsed,
        generator_dispatch=gen_disp,
        line_flows=line_flows,
        lmps=lmp_points,
        battery_trajectories=bat_traj,
        data_center_trajectories=dc_traj,
        renewable_trajectories=renew_traj,
        revenue=bat_revs + dc_revs + renew_revs,
    )


__all__ = ["solve_multiperiod_dcopf", "hours_grid"]
