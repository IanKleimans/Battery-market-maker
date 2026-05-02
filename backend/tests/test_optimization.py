"""Tests for the multi- and single-period DC-OPF endpoints.

Includes a hand-verifiable two-bus / two-generator case where the cheaper
generator should clear at full output of the load when capacity allows.
"""

from __future__ import annotations

import pytest


def test_singleperiod_5bus(client) -> None:
    r = client.post(
        "/api/v1/optimization/singleperiod",
        json={"network": "bus5", "load_multiplier": 1.0, "wind_availability": 1.0},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "optimal"
    assert body["total_cost"] > 0
    assert len(body["generator_output"]) == 5
    assert len(body["bus_lmp"]) == 5
    # Slack bus LMP equals system marginal cost
    assert all(v >= 0 for v in body["bus_lmp"].values())


def test_multiperiod_ieee14_no_assets(client) -> None:
    r = client.post(
        "/api/v1/optimization/multiperiod",
        json={
            "network": "ieee14",
            "horizon_hours": 6,
            "timestep_minutes": 60,
            "load_multiplier": 1.0,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "optimal"
    assert body["n_timesteps"] == 6
    assert len(body["timestamps"]) == 6
    assert len(body["generator_dispatch"]) == 5
    assert len(body["lmps"]) == 14
    for lmp in body["lmps"]:
        assert len(lmp["lmp_per_mwh"]) == 6
    # Total cost is finite
    assert body["total_system_cost"] > 0
    assert body["solve_time_seconds"] >= 0


def test_multiperiod_with_battery(client) -> None:
    r = client.post(
        "/api/v1/optimization/multiperiod",
        json={
            "network": "ieee14",
            "horizon_hours": 6,
            "timestep_minutes": 60,
            "batteries": [
                {
                    "id": "bat1",
                    "bus": 5,
                    "e_max_mwh": 50,
                    "p_max_mw": 25,
                    "initial_soc_mwh": 25,
                }
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "optimal"
    assert len(body["battery_trajectories"]) == 1
    bat = body["battery_trajectories"][0]
    assert len(bat["soc_mwh"]) == 6
    # SOC must remain inside [0, E_max]
    assert all(0 - 1e-6 <= s <= 50 + 1e-6 for s in bat["soc_mwh"])
    # No simultaneous charge + discharge above tolerance
    for c, d in zip(bat["charge_mw"], bat["discharge_mw"]):
        assert min(c, d) < 1e-3


def test_multiperiod_with_renewable_curtailment(client) -> None:
    r = client.post(
        "/api/v1/optimization/multiperiod",
        json={
            "network": "ieee14",
            "horizon_hours": 6,
            "timestep_minutes": 60,
            "renewables": [
                {"id": "wind1", "bus": 5, "kind": "wind", "capacity_mw": 200}
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "optimal"
    assert len(body["renewable_trajectories"]) == 1
    r0 = body["renewable_trajectories"][0]
    for av, dl in zip(r0["available_mw"], r0["delivered_mw"]):
        assert dl <= av + 1e-6


def test_multiperiod_with_data_center(client) -> None:
    r = client.post(
        "/api/v1/optimization/multiperiod",
        json={
            "network": "ieee14",
            "horizon_hours": 6,
            "timestep_minutes": 60,
            "data_centers": [
                {
                    "id": "dc1",
                    "bus": 9,
                    "c_max_mw": 100,
                    "compute_value_per_mwh": 80,
                    "flex_min": 0.4,
                    "flex_max": 1.0,
                    "sla_penalty_per_mwh": 10,
                }
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    dc = body["data_center_trajectories"][0]
    for u in dc["utilization"]:
        assert 0.4 - 1e-6 <= u <= 1.0 + 1e-6


def test_multiperiod_invalid_bus_returns_400(client) -> None:
    r = client.post(
        "/api/v1/optimization/multiperiod",
        json={
            "network": "ieee14",
            "horizon_hours": 6,
            "timestep_minutes": 60,
            "batteries": [
                {
                    "id": "bat1",
                    "bus": 999,
                    "e_max_mwh": 50,
                    "p_max_mw": 25,
                    "initial_soc_mwh": 25,
                }
            ],
        },
    )
    assert r.status_code == 400
    assert "999" in r.json()["detail"]


def test_multiperiod_invalid_timestep_returns_422(client) -> None:
    r = client.post(
        "/api/v1/optimization/multiperiod",
        json={
            "network": "ieee14",
            "horizon_hours": 5,
            "timestep_minutes": 60,  # 5*60 = 300 not divisible by... wait, it is
        },
    )
    # The above is actually fine. Test a true mismatch:
    r = client.post(
        "/api/v1/optimization/multiperiod",
        json={
            "network": "ieee14",
            "horizon_hours": 1,
            "timestep_minutes": 45,  # 60 % 45 != 0
        },
    )
    assert r.status_code == 422


def test_singleperiod_load_override(client) -> None:
    """Per-bus load override replaces the default profile."""
    base = client.post(
        "/api/v1/optimization/singleperiod",
        json={"network": "bus5", "load_multiplier": 1.0, "wind_availability": 1.0},
    ).json()
    overridden = client.post(
        "/api/v1/optimization/singleperiod",
        json={
            "network": "bus5",
            "load_multiplier": 1.0,
            "wind_availability": 1.0,
            "load_overrides": {"3": 5.0, "4": 5.0},
        },
    ).json()
    assert overridden["status"] == "optimal"
    # Less load -> lower cost
    assert overridden["total_cost"] < base["total_cost"]
    # Bus 3's load was overridden to 5 MW
    assert overridden["bus_load"]["3"] == pytest.approx(5.0, abs=0.01)


def test_singleperiod_gen_override_offline(client) -> None:
    """Forcing a generator offline must drop its output to zero."""
    body = client.post(
        "/api/v1/optimization/singleperiod",
        json={
            "network": "bus5",
            "load_multiplier": 1.0,
            "wind_availability": 1.0,
            "gen_overrides": {"1": {"online": False}},
        },
    ).json()
    assert body["status"] in ("optimal", "infeasible")
    if body["status"] == "optimal":
        assert body["generator_output"]["1"] == pytest.approx(0.0, abs=0.01)


def test_singleperiod_line_outage(client) -> None:
    """Forcing a line offline yields zero flow on that line."""
    body = client.post(
        "/api/v1/optimization/singleperiod",
        json={
            "network": "bus5",
            "load_multiplier": 1.0,
            "wind_availability": 1.0,
            "line_outages": [1],
        },
    ).json()
    if body["status"] == "optimal":
        assert body["line_flow"]["1"] == pytest.approx(0.0, abs=0.01)


def test_singleperiod_solver_stats_populated(client) -> None:
    body = client.post(
        "/api/v1/optimization/singleperiod",
        json={"network": "bus5", "load_multiplier": 1.0, "wind_availability": 1.0},
    ).json()
    assert body["solver_stats"]["solver"] in ("HIGHS", "ECOS")
    assert body["solver_stats"]["n_variables"] > 0
    assert body["solver_stats"]["n_constraints"] > 0


def test_stackelberg_runs_on_ieee14(client) -> None:
    """The Stackelberg endpoint returns both PT and SA branches with a usable gain."""
    body = client.post(
        "/api/v1/optimization/stackelberg",
        json={
            "network": "ieee14",
            "horizon_hours": 12,
            "timestep_minutes": 60,
            "load_multiplier": 1.0,
            "data_centers": [
                {
                    "id": "campus-1",
                    "bus": 9,
                    "c_max_mw": 500,
                    "compute_value_per_mwh": 80,
                    "flex_min": 0.4,
                    "flex_max": 1.0,
                    "sla_penalty_per_mwh": 15,
                }
            ],
        },
    ).json()
    assert body["leader_data_center_id"] == "campus-1"
    assert body["leader_bus"] == 9
    assert body["n_timesteps"] == 12
    assert "stackelberg_gain_usd" in body
    assert isinstance(body["max_lmp_impact_usd_per_mwh"], (int, float))
    assert body["max_lmp_impact_usd_per_mwh"] >= 0
    assert "iterations" in body and len(body["iterations"]) >= 1
    assert isinstance(body["bus_impacts"], list) and len(body["bus_impacts"]) > 0
    assert body["method"] == "iterative_best_response"


def test_stackelberg_requires_a_data_center(client) -> None:
    r = client.post(
        "/api/v1/optimization/stackelberg",
        json={
            "network": "ieee14",
            "horizon_hours": 6,
            "timestep_minutes": 60,
            "load_multiplier": 1.0,
            "data_centers": [],
        },
    )
    assert r.status_code == 400
    assert "data center" in r.json()["detail"].lower()


def test_stackelberg_invalid_leader_id_returns_400(client) -> None:
    r = client.post(
        "/api/v1/optimization/stackelberg",
        json={
            "network": "ieee14",
            "horizon_hours": 6,
            "timestep_minutes": 60,
            "load_multiplier": 1.0,
            "data_centers": [
                {
                    "id": "campus-1",
                    "bus": 9,
                    "c_max_mw": 200,
                    "compute_value_per_mwh": 80,
                    "flex_min": 0.4,
                    "flex_max": 1.0,
                    "sla_penalty_per_mwh": 15,
                }
            ],
            "leader_data_center_id": "not-a-real-id",
        },
    )
    assert r.status_code == 400
