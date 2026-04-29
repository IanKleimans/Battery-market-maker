"""Schemas for single-asset SDP comparison (PF-LP / Myopic / MPC)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PolicyName = Literal["perfect_foresight", "myopic_greedy", "mpc"]


class BatteryParamsSchema(BaseModel):
    e_max_mwh: float = Field(100.0, gt=0)
    p_max_mw: float = Field(50.0, gt=0)
    eta_c: float = Field(0.92, gt=0, le=1)
    eta_d: float = Field(0.92, gt=0, le=1)
    kappa: float = Field(2.0, ge=0)
    initial_soc_mwh: float = Field(50.0, ge=0)
    rho_assumed: float = Field(0.95, ge=0, le=1)


class SDPRequest(BaseModel):
    """Run one or more battery dispatch policies against a price series."""

    policies: list[PolicyName] = Field(default_factory=lambda: ["perfect_foresight"])
    battery: BatteryParamsSchema = Field(default_factory=BatteryParamsSchema)
    horizon_hours: int = Field(24, gt=0, le=168)
    timestep_minutes: int = Field(5, gt=0)
    mpc_horizon_hours: int = Field(4, gt=0)
    forecast: Literal["perfect", "naive", "xgboost"] = "perfect"
    seed: int = 42


class PolicyResult(BaseModel):
    policy_name: PolicyName
    total_revenue: float
    energy_revenue: float
    regulation_revenue: float
    degradation_cost: float
    solve_time_seconds: float
    schedule_charge_mw: list[float]
    schedule_discharge_mw: list[float]
    schedule_soc_mwh: list[float]
    schedule_lmp: list[float]


class SDPResponse(BaseModel):
    timestamps: list[str]
    policies: list[PolicyResult]
