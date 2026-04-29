"""Pre-built scenario endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.scenarios.library import get_scenario, list_scenarios
from app.schemas.scenarios import Scenario, ScenarioSummary

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioSummary])
def list_all() -> list[ScenarioSummary]:
    """List all pre-built scenarios with one-line summaries."""
    return [
        ScenarioSummary(
            id=s.id,
            title=s.title,
            short_description=s.short_description,
            network=s.network,
            tags=s.tags,
        )
        for s in list_scenarios()
    ]


@router.get("/{scenario_id}", response_model=Scenario)
def get_one(scenario_id: str) -> Scenario:
    """Return the full scenario configuration."""
    try:
        return get_scenario(scenario_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
