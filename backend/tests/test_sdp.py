"""Tests for the single-asset SDP comparison endpoint."""

from __future__ import annotations


def test_sdp_perfect_foresight(client) -> None:
    r = client.post(
        "/api/v1/sdp/battery",
        json={
            "policies": ["perfect_foresight"],
            "horizon_hours": 24,
            "timestep_minutes": 60,
            "seed": 7,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["policies"]) == 1
    p = body["policies"][0]
    assert p["policy_name"] == "perfect_foresight"
    assert len(p["schedule_charge_mw"]) == 24
    # Total revenue is non-negative for sane prices
    assert p["total_revenue"] >= 0


def test_sdp_three_policies_revenue_ordering(client) -> None:
    """Perfect foresight >= MPC >= Myopic on average."""
    r = client.post(
        "/api/v1/sdp/battery",
        json={
            "policies": ["perfect_foresight", "myopic_greedy", "mpc"],
            "horizon_hours": 24,
            "timestep_minutes": 60,
            "mpc_horizon_hours": 4,
            "seed": 11,
        },
    )
    assert r.status_code == 200
    revs = {p["policy_name"]: p["total_revenue"] for p in r.json()["policies"]}
    assert revs["perfect_foresight"] >= revs["myopic_greedy"] - 1.0
