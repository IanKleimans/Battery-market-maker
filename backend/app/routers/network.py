"""Endpoints for IEEE network topologies."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.network.topologies import get_network, list_networks
from app.schemas.network import NetworkData, NetworkSummary

router = APIRouter(prefix="/networks", tags=["networks"])


@router.get("", response_model=list[NetworkSummary])
def list_all() -> list[NetworkSummary]:
    """List all available network topologies."""
    return [
        NetworkSummary(
            name=name,  # type: ignore[arg-type]
            display_name=data.display_name,
            n_buses=len(data.buses),
            n_lines=len(data.lines),
            n_generators=len(data.generators),
            description=desc,
        )
        for name, data, desc in list_networks()
    ]


@router.get("/{name}", response_model=NetworkData)
def get_one(name: str) -> NetworkData:
    """Return full topology for one network."""
    try:
        return get_network(name)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
