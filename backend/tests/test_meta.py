"""Smoke tests for root and health endpoints."""

from __future__ import annotations


def test_root(client) -> None:
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["docs"] == "/docs"
    assert "version" in body


def test_health(client) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_api_health(client) -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200


def test_openapi_renders(client) -> None:
    r = client.get("/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    # All expected tags should be present
    paths = spec["paths"]
    assert "/api/v1/networks" in paths
    assert "/api/v1/optimization/multiperiod" in paths
    assert "/api/v1/scenarios" in paths
