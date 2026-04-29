"""Endpoint for the single-asset SDP comparison (PF / Myopic / MPC)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.sdp import SDPRequest, SDPResponse
from app.solvers.sdp_wrapper import run_sdp_comparison

router = APIRouter(prefix="/sdp", tags=["sdp"])


@router.post(
    "/battery",
    response_model=SDPResponse,
    summary="Run battery dispatch policies on synthetic prices",
    description=(
        "Run one or more battery dispatch policies against a synthetic price "
        "series and return their realised schedules, revenues, and solve times. "
        "Backed by the research code in `src/policies/`."
    ),
)
def battery(req: SDPRequest) -> SDPResponse:
    try:
        return run_sdp_comparison(
            policies=req.policies,
            battery=req.battery,
            horizon_hours=req.horizon_hours,
            timestep_minutes=req.timestep_minutes,
            mpc_horizon_hours=req.mpc_horizon_hours,
            forecast=req.forecast,
            seed=req.seed,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
