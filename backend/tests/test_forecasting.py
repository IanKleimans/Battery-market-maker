"""Tests for the forecast quality endpoint."""

from __future__ import annotations


def test_perfect_forecast_has_zero_error(client) -> None:
    r = client.post(
        "/api/v1/forecasting/quality",
        json={"forecast_type": "perfect", "horizon_hours": 24, "seed": 1},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["rmse_per_mwh"] == 0
    assert body["mae_per_mwh"] == 0
    assert body["bias_per_mwh"] == 0


def test_naive_forecast_has_nonzero_error(client) -> None:
    r = client.post(
        "/api/v1/forecasting/quality",
        json={"forecast_type": "naive", "horizon_hours": 48, "seed": 1},
    )
    assert r.status_code == 200
    assert r.json()["rmse_per_mwh"] > 0


def test_xgboost_forecast_better_than_naive(client) -> None:
    r_naive = client.post(
        "/api/v1/forecasting/quality",
        json={"forecast_type": "naive", "horizon_hours": 48, "seed": 1},
    ).json()
    r_xgb = client.post(
        "/api/v1/forecasting/quality",
        json={"forecast_type": "xgboost", "horizon_hours": 48, "seed": 1},
    ).json()
    # Naive persistence should typically be worse than the synthetic XGBoost noise model
    assert r_xgb["rmse_per_mwh"] < r_naive["rmse_per_mwh"]
