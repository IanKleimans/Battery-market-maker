"""Endpoints for multi-period and single-period DC-OPF."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.network.topologies import get_network
from app.schemas.optimization import (
    MultiPeriodRequest,
    MultiPeriodSolution,
    SinglePeriodRequest,
    SinglePeriodSolution,
)
from app.solvers.multiperiod_opf import solve_multiperiod_dcopf
from app.solvers.singleperiod_opf import solve_single_period

router = APIRouter(prefix="/optimization", tags=["optimization"])


@router.post(
    "/multiperiod",
    response_model=MultiPeriodSolution,
    summary="Multi-period DC-OPF with assets",
    description=(
        "Solve a deterministic multi-period DC-OPF with batteries, flexible data "
        "centers, and renewable generators.  Returns per-timestep dispatch, line "
        "flows, LMPs (from constraint duals), SOC trajectories, DC utilisation, "
        "renewable curtailment, and a per-asset revenue breakdown."
    ),
)
def multiperiod(req: MultiPeriodRequest) -> MultiPeriodSolution:
    try:
        network = get_network(req.network)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    # Validate asset bus references
    bus_ids = {b.id for b in network.buses}
    for asset_list, kind in [
        (req.batteries, "battery"),
        (req.data_centers, "data_center"),
        (req.renewables, "renewable"),
    ]:
        for a in asset_list:
            if a.bus not in bus_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"{kind} {a.id!r} placed on unknown bus {a.bus}",
                )

    return solve_multiperiod_dcopf(
        network=network,
        horizon_hours=req.horizon_hours,
        timestep_minutes=req.timestep_minutes,
        load_multiplier=req.load_multiplier,
        batteries=req.batteries,
        data_centers=req.data_centers,
        renewables=req.renewables,
        forecast=req.forecast,
    )


@router.post(
    "/singleperiod",
    response_model=SinglePeriodSolution,
    summary="Single-period DC-OPF (Live mode)",
    description=(
        "Solve a single-period DC economic dispatch.  Used by the Live simulator "
        "to refresh on every slider change."
    ),
)
def singleperiod(req: SinglePeriodRequest) -> SinglePeriodSolution:
    try:
        network = get_network(req.network)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return solve_single_period(
        network=network,
        load_multiplier=req.load_multiplier,
        wind_availability=req.wind_availability,
        line_capacity_overrides=req.line_capacity_overrides,
        line_outages=req.line_outages,
        load_overrides=req.load_overrides,
        gen_overrides=req.gen_overrides,
    )
