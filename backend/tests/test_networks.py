"""Network topology endpoint tests."""

from __future__ import annotations

import pytest


def test_list_networks(client) -> None:
    r = client.get("/api/v1/networks")
    assert r.status_code == 200
    body = r.json()
    names = {n["name"] for n in body}
    assert names == {"bus5", "ieee14", "ieee30"}


@pytest.mark.parametrize("name,n_buses", [("bus5", 5), ("ieee14", 14), ("ieee30", 30)])
def test_get_network(client, name: str, n_buses: int) -> None:
    r = client.get(f"/api/v1/networks/{name}")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == name
    assert len(body["buses"]) == n_buses

    # Exactly one slack bus
    slack_buses = [b for b in body["buses"] if b["is_slack"]]
    assert len(slack_buses) == 1

    # All line endpoints reference real buses
    bus_ids = {b["id"] for b in body["buses"]}
    for ln in body["lines"]:
        assert ln["from_bus"] in bus_ids
        assert ln["to_bus"] in bus_ids
        assert ln["reactance"] > 0
        assert ln["capacity_mva"] > 0

    # Generator capacity is positive
    for g in body["generators"]:
        assert g["capacity_mw"] > 0
        assert g["bus"] in bus_ids


def test_unknown_network_returns_404(client) -> None:
    r = client.get("/api/v1/networks/no-such-network")
    assert r.status_code == 404
