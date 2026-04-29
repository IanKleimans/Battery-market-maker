"""Synthetic load and renewable forecasts used when real PJM data isn't loaded.

These match the shapes used in the original SDP code in ``src/utils/synthetic_data.py``
so the optimiser sees realistic diurnal patterns.
"""

from __future__ import annotations

import math

import numpy as np


def hours_grid(horizon_hours: int, timestep_minutes: int) -> np.ndarray:
    """Hours-since-start grid for the horizon."""
    n = (horizon_hours * 60) // timestep_minutes
    return np.arange(n) * (timestep_minutes / 60.0)


def load_profile(
    profile_type: str,
    horizon_hours: int,
    timestep_minutes: int,
    start_hour: int = 0,
) -> np.ndarray:
    """Per-unit load profile in [0, 1]. Daily diurnal shape per profile type."""
    h = hours_grid(horizon_hours, timestep_minutes) + start_hour
    hour_of_day = h % 24
    if profile_type == "residential":
        # Two peaks: morning (7-9) and evening (17-21)
        morning = np.exp(-((hour_of_day - 8) ** 2) / 6.0) * 0.7
        evening = np.exp(-((hour_of_day - 19) ** 2) / 8.0) * 1.0
        base = 0.45 + morning + evening
    elif profile_type == "commercial":
        # Single broad peak 9-17
        base = 0.40 + np.exp(-((hour_of_day - 13) ** 2) / 18.0) * 0.85
    elif profile_type == "industrial":
        # Steady with a small midday lift
        base = 0.75 + 0.15 * np.sin((hour_of_day - 6) / 24.0 * 2 * math.pi)
    else:  # flat
        base = np.full_like(h, 0.85)
    return np.clip(base, 0.1, 1.2)


def solar_profile(
    horizon_hours: int,
    timestep_minutes: int,
    start_hour: int = 0,
    seed: int | None = None,
) -> np.ndarray:
    """Per-unit solar availability with a noon-peaked diurnal shape."""
    h = hours_grid(horizon_hours, timestep_minutes) + start_hour
    hour_of_day = h % 24
    daylight = np.maximum(0.0, np.sin((hour_of_day - 6) / 12.0 * math.pi))
    rng = np.random.default_rng(seed)
    cloud = 1.0 - 0.25 * rng.random(size=h.shape)
    return np.clip(daylight * cloud, 0.0, 1.0)


def wind_profile(
    horizon_hours: int,
    timestep_minutes: int,
    start_hour: int = 0,
    seed: int | None = None,
) -> np.ndarray:
    """Per-unit wind availability — high overnight, lower during the day."""
    h = hours_grid(horizon_hours, timestep_minutes) + start_hour
    hour_of_day = h % 24
    diurnal = 0.55 - 0.35 * np.sin((hour_of_day - 6) / 24.0 * 2 * math.pi)
    rng = np.random.default_rng(None if seed is None else seed + 1)
    gust = 0.9 + 0.4 * rng.random(size=h.shape)
    return np.clip(diurnal * gust, 0.0, 1.0)


def perturb(
    truth: np.ndarray,
    forecast_type: str,
    seed: int | None = None,
) -> np.ndarray:
    """Apply a forecast-error model to a 'truth' signal in [0, 1]."""
    if forecast_type == "perfect":
        return truth.copy()
    rng = np.random.default_rng(seed)
    if forecast_type == "naive":
        # Persistence: shift by 24h-equivalent indices, fill with mean
        n = len(truth)
        shift = max(1, n // 6)
        out = np.empty_like(truth)
        out[:shift] = truth.mean()
        out[shift:] = truth[:-shift]
        return out
    if forecast_type == "xgboost":
        # XGBoost-style: small bias + heteroscedastic noise
        noise = rng.normal(0, 0.05, size=truth.shape) * (0.5 + 0.5 * truth)
        return np.clip(truth + noise, 0.0, 1.0)
    raise ValueError(f"Unknown forecast type: {forecast_type}")
