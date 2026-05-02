"""Endpoint for the Stackelberg / market-maker analysis."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.network.topologies import get_network
from app.schemas.stackelberg import StackelbergRequest, StackelbergSolution
from app.solvers.stackelberg import solve_stackelberg

router = APIRouter(prefix="/optimization", tags=["optimization"])


@router.post(
    "/stackelberg",
    response_model=StackelbergSolution,
    summary="Stackelberg / market-maker analysis",
    description=(
        "Compare a flexible AI campus's revenue and grid impact under two "
        "strategies: (1) price-taker, where the campus assumes its dispatch "
        "doesn't move LMPs, and (2) Stackelberg-aware, where the campus "
        "accounts for its own market impact via the LP-equivalent equilibrium. "
        "Implementation: iterative best-response. A full MPEC / KKT-folded "
        "bilevel reformulation is documented as future work in the report."
    ),
)
def stackelberg(req: StackelbergRequest) -> StackelbergSolution:
    try:
        network = get_network(req.network)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

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

    try:
        return solve_stackelberg(
            network=network,
            horizon_hours=req.horizon_hours,
            timestep_minutes=req.timestep_minutes,
            load_multiplier=req.load_multiplier,
            batteries=req.batteries,
            data_centers=req.data_centers,
            renewables=req.renewables,
            forecast=req.forecast,
            leader_data_center_id=req.leader_data_center_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
