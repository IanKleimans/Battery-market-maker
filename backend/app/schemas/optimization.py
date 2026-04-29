"""Schemas for multi-period DC-OPF requests and responses."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.network import NetworkName

ForecastSource = Literal["perfect", "naive", "xgboost", "custom"]


class BatteryAsset(BaseModel):
    """A grid-scale battery placed on a bus."""

    id: str
    bus: int
    e_max_mwh: float = Field(..., gt=0, description="Energy capacity (MWh)")
    p_max_mw: float = Field(..., gt=0, description="Power rating (MW)")
    eta_c: float = Field(0.92, gt=0, le=1, description="Charge efficiency")
    eta_d: float = Field(0.92, gt=0, le=1, description="Discharge efficiency")
    kappa: float = Field(2.0, ge=0, description="Degradation cost ($/MWh throughput)")
    initial_soc_mwh: float = Field(..., ge=0)

    @field_validator("initial_soc_mwh")
    @classmethod
    def soc_within_capacity(cls, v: float, info) -> float:
        e_max = info.data.get("e_max_mwh")
        if e_max is not None and v > e_max:
            raise ValueError(f"initial_soc_mwh ({v}) exceeds e_max_mwh ({e_max})")
        return v


class DataCenterAsset(BaseModel):
    """A flexible data center load placed on a bus."""

    id: str
    bus: int
    c_max_mw: float = Field(..., gt=0, description="Peak compute power (MW)")
    compute_value_per_mwh: float = Field(
        ..., gt=0, description="Marginal value of one MWh of compute ($)"
    )
    flex_min: float = Field(0.0, ge=0, le=1, description="Minimum utilisation fraction")
    flex_max: float = Field(1.0, ge=0, le=1, description="Maximum utilisation fraction")
    sla_penalty_per_mwh: float = Field(
        0.0, ge=0, description="Penalty for unserved compute ($/MWh)"
    )

    @field_validator("flex_max")
    @classmethod
    def flex_range(cls, v: float, info) -> float:
        fmin = info.data.get("flex_min", 0.0)
        if v < fmin:
            raise ValueError(f"flex_max ({v}) must be >= flex_min ({fmin})")
        return v


class RenewableAsset(BaseModel):
    """A renewable generator (variable, may be curtailed)."""

    id: str
    bus: int
    kind: Literal["solar", "wind"]
    capacity_mw: float = Field(..., gt=0)
    curtailment_penalty_per_mwh: float = Field(0.0, ge=0)


class ForecastSpec(BaseModel):
    """Which forecast source to use for variable inputs."""

    source: ForecastSource = "perfect"
    seed: int | None = None
    custom_csv: str | None = Field(
        default=None, description="Inline CSV content for `source=custom`"
    )


class MultiPeriodRequest(BaseModel):
    """Full request body for the multi-period DC-OPF."""

    network: NetworkName = "ieee14"
    horizon_hours: int = Field(24, gt=0, le=168)
    timestep_minutes: int = Field(60, gt=0)
    load_multiplier: float = Field(1.0, gt=0, le=3.0)
    batteries: list[BatteryAsset] = Field(default_factory=list)
    data_centers: list[DataCenterAsset] = Field(default_factory=list)
    renewables: list[RenewableAsset] = Field(default_factory=list)
    forecast: ForecastSpec = Field(default_factory=ForecastSpec)

    @field_validator("timestep_minutes")
    @classmethod
    def timestep_divides_horizon(cls, v: int, info) -> int:
        h = info.data.get("horizon_hours")
        if h is not None and (h * 60) % v != 0:
            raise ValueError(f"timestep_minutes ({v}) must divide horizon ({h} h)")
        return v


class GenDispatchPoint(BaseModel):
    gen_id: int
    p_mw: list[float]


class LineFlowPoint(BaseModel):
    line_id: int
    flow_mw: list[float]
    utilization: list[float]


class LMPPoint(BaseModel):
    bus: int
    lmp_per_mwh: list[float]


class BatteryTrajectory(BaseModel):
    asset_id: str
    soc_mwh: list[float]
    charge_mw: list[float]
    discharge_mw: list[float]


class DataCenterTrajectory(BaseModel):
    asset_id: str
    utilization: list[float]
    consumption_mw: list[float]


class RenewableTrajectory(BaseModel):
    asset_id: str
    available_mw: list[float]
    delivered_mw: list[float]
    curtailment_mw: list[float]


class RevenueBreakdown(BaseModel):
    """Per-asset revenue breakdown over the horizon (USD)."""

    asset_id: str
    asset_kind: Literal["battery", "data_center", "renewable"]
    energy_revenue: float = 0.0
    compute_revenue: float = 0.0
    degradation_cost: float = 0.0
    sla_penalty: float = 0.0
    curtailment_penalty: float = 0.0
    total: float = 0.0


class MultiPeriodSolution(BaseModel):
    """Response body for the multi-period DC-OPF."""

    status: Literal["optimal", "optimal_inaccurate", "infeasible"]
    horizon_hours: int
    timestep_minutes: int
    n_timesteps: int
    timestamps: list[str] = Field(..., description="ISO-8601 timestamps per step")

    total_system_cost: float
    solve_time_seconds: float

    generator_dispatch: list[GenDispatchPoint]
    line_flows: list[LineFlowPoint]
    lmps: list[LMPPoint]

    battery_trajectories: list[BatteryTrajectory]
    data_center_trajectories: list[DataCenterTrajectory]
    renewable_trajectories: list[RenewableTrajectory]

    revenue: list[RevenueBreakdown]


class SinglePeriodRequest(BaseModel):
    """Body for the Live-mode single-period DC-OPF."""

    network: NetworkName = "ieee14"
    load_multiplier: float = Field(1.0, gt=0, le=3.0)
    wind_availability: float = Field(1.0, ge=0, le=1.0)
    line_capacity_overrides: dict[int, float] = Field(default_factory=dict)


class SinglePeriodSolution(BaseModel):
    status: Literal["optimal", "optimal_inaccurate", "infeasible"]
    total_cost: float
    solve_time_seconds: float
    generator_output: dict[int, float]
    line_flow: dict[int, float]
    line_utilization: dict[int, float]
    bus_lmp: dict[int, float]
    bus_load: dict[int, float]
