"""Schemas for the Stackelberg / market-maker analysis endpoint."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.optimization import (
    BatteryAsset,
    DataCenterAsset,
    ForecastSpec,
    RenewableAsset,
)
from app.schemas.network import NetworkName

LeaderStrategy = Literal["price_taker", "stackelberg_aware"]


class StackelbergRequest(BaseModel):
    """Run a market-maker (Stackelberg) analysis on the given network + assets.

    The endpoint always returns both the price-taker baseline and the
    Stackelberg-aware solution so the UI can show the gain side-by-side.
    """

    network: NetworkName = "ieee14"
    horizon_hours: int = Field(24, gt=0, le=72)
    timestep_minutes: int = Field(60, gt=0)
    load_multiplier: float = Field(1.0, gt=0, le=3.0)
    batteries: list[BatteryAsset] = Field(default_factory=list)
    data_centers: list[DataCenterAsset] = Field(default_factory=list)
    renewables: list[RenewableAsset] = Field(default_factory=list)
    forecast: ForecastSpec = Field(default_factory=ForecastSpec)

    leader_data_center_id: str | None = Field(
        default=None,
        description=(
            "ID of the data center treated as the Stackelberg leader. If null, "
            "the largest data center by c_max_mw is used."
        ),
    )


class BusLMPImpact(BaseModel):
    """LMP shift at a single bus from price-taker -> stackelberg-aware."""

    bus: int
    name: str
    lmp_price_taker: float
    lmp_stackelberg_aware: float
    delta: float


class IterationTrace(BaseModel):
    """One iteration of the best-response loop."""

    iteration: int
    leader_revenue: float
    max_lmp_change: float


class StackelbergSolution(BaseModel):
    """Full output of the analysis."""

    network: NetworkName
    horizon_hours: int
    timestep_minutes: int
    n_timesteps: int
    timestamps: list[str]

    leader_data_center_id: str
    leader_bus: int

    # Price-taker baseline: campus's dispatch fixed at its own optimum given
    # exogenous (no-asset) LMPs; ISO re-clears with that fixed dispatch.
    price_taker_total_system_cost: float
    price_taker_lmps_per_bus_avg: dict[int, float]
    price_taker_leader_revenue: float
    price_taker_leader_consumption_mw: list[float]

    # Stackelberg-aware: campus and ISO solved jointly (LP equilibrium).
    stackelberg_total_system_cost: float
    stackelberg_lmps_per_bus_avg: dict[int, float]
    stackelberg_leader_revenue: float
    stackelberg_leader_consumption_mw: list[float]

    # Headline numbers
    stackelberg_gain_usd: float
    """Leader's revenue under SA minus revenue under PT (positive = SA wins)."""

    max_lmp_impact_usd_per_mwh: float
    """Largest absolute LMP shift across all (bus, timestep) pairs."""

    market_power_index: float
    """Approx fraction of total system congestion rent captured by the leader's
    strategy choice. Above 5% suggests the price-taker assumption is breaking down. """

    bus_impacts: list[BusLMPImpact]

    iterations: list[IterationTrace]
    converged: bool
    method: Literal["iterative_best_response"] = "iterative_best_response"
