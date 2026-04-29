"""Pre-built scenario schemas."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.optimization import MultiPeriodRequest


class ScenarioSummary(BaseModel):
    id: str
    title: str
    short_description: str
    network: str
    tags: list[str] = []


class Scenario(BaseModel):
    id: str
    title: str
    short_description: str
    long_description: str
    key_insight: str
    network: str
    tags: list[str] = []
    config: MultiPeriodRequest
