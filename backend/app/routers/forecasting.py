"""Forecast quality endpoints."""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter

from app.schemas.forecasting import ForecastQualityRequest, ForecastQualityResponse
from app.solvers.forecasts import perturb, solar_profile

router = APIRouter(prefix="/forecasting", tags=["forecasting"])


@router.post(
    "/quality",
    response_model=ForecastQualityResponse,
    summary="Forecast vs realised solar (or load) quality metrics",
)
def quality(req: ForecastQualityRequest) -> ForecastQualityResponse:
    truth = solar_profile(req.horizon_hours, 60, seed=req.seed)
    fc = perturb(truth, req.forecast_type, seed=req.seed)
    err = fc - truth
    rmse = float(np.sqrt(np.mean(err**2)))
    mae = float(np.mean(np.abs(err)))
    bias = float(np.mean(err))
    idx = pd.date_range("2024-01-01T00:00:00Z", periods=len(truth), freq="h")
    return ForecastQualityResponse(
        forecast_type=req.forecast_type,
        rmse_per_mwh=rmse,
        mae_per_mwh=mae,
        bias_per_mwh=bias,
        actual=truth.tolist(),
        forecast=fc.tolist(),
        timestamps=[t.isoformat() for t in idx],
    )
