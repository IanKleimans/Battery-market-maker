"""Schemas for forecast quality endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ForecastQualityRequest(BaseModel):
    forecast_type: Literal["perfect", "naive", "xgboost"]
    horizon_hours: int = Field(24, gt=0, le=168)
    n_samples: int = Field(100, gt=0, le=2000)
    seed: int = 42


class ForecastQualityResponse(BaseModel):
    forecast_type: str
    rmse_per_mwh: float
    mae_per_mwh: float
    bias_per_mwh: float
    actual: list[float]
    forecast: list[float]
    timestamps: list[str]
