"""Network topology schemas: buses, lines, generators, loads."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

NetworkName = Literal["bus5", "ieee14", "ieee30"]
FuelType = Literal["coal", "gas", "nuclear", "hydro", "wind", "solar", "oil"]


class Bus(BaseModel):
    id: int
    name: str
    base_kv: float = Field(..., description="Base voltage in kV")
    x: float = Field(..., description="Layout x coordinate (0-1200 viewport)")
    y: float = Field(..., description="Layout y coordinate (0-800 viewport)")
    is_slack: bool = False


class Line(BaseModel):
    id: int
    from_bus: int
    to_bus: int
    name: str
    reactance: float = Field(..., description="Series reactance per-unit on system base")
    capacity_mva: float = Field(..., description="Thermal limit (MVA)")


class Generator(BaseModel):
    id: int
    bus: int
    name: str
    fuel: FuelType
    capacity_mw: float
    cost_per_mwh: float = Field(..., description="Marginal energy cost ($/MWh)")
    ramp_rate_mw_per_min: float = 5.0
    min_output_mw: float = 0.0


class Load(BaseModel):
    bus: int
    peak_mw: float
    profile_type: Literal["residential", "commercial", "industrial", "flat"] = "commercial"


class NetworkData(BaseModel):
    """Full topology returned by `GET /networks/{name}`."""

    name: NetworkName
    display_name: str
    base_mva: float = 100.0
    buses: list[Bus]
    lines: list[Line]
    generators: list[Generator]
    loads: list[Load]


class NetworkSummary(BaseModel):
    """Lightweight listing for `GET /networks`."""

    name: NetworkName
    display_name: str
    n_buses: int
    n_lines: int
    n_generators: int
    description: str
