"""Pre-built scenario endpoint tests."""

from __future__ import annotations


def test_list_scenarios(client) -> None:
    r = client.get("/api/v1/scenarios")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 10
    ids = {s["id"] for s in items}
    assert "5bus-classic" in ids
    assert "battery-saves-the-day" in ids


def test_get_scenario(client) -> None:
    r = client.get("/api/v1/scenarios/battery-saves-the-day")
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Battery Saves the Day"
    assert len(body["config"]["batteries"]) == 1
    assert len(body["config"]["renewables"]) == 1


def test_get_scenario_404(client) -> None:
    r = client.get("/api/v1/scenarios/no-such-scenario")
    assert r.status_code == 404


def test_every_scenario_solves(client) -> None:
    """Every pre-built scenario should solve to optimality.

    This is the deepest end-to-end test — full pipeline from scenario config
    to multi-period DC-OPF.
    """
    items = client.get("/api/v1/scenarios").json()
    for s in items:
        full = client.get(f"/api/v1/scenarios/{s['id']}").json()
        # Run it on a short horizon to keep the test fast
        cfg = full["config"].copy()
        cfg["horizon_hours"] = 6
        r = client.post("/api/v1/optimization/multiperiod", json=cfg)
        assert r.status_code == 200, (s["id"], r.text)
        body = r.json()
        assert body["status"] in ("optimal", "optimal_inaccurate"), s["id"]
