"""WebSocket smoke test using TestClient."""

from __future__ import annotations


def test_websocket_solve_completes(client) -> None:
    with client.websocket_connect("/api/v1/ws/solve") as ws:
        ws.send_json(
            {
                "network": "ieee14",
                "horizon_hours": 6,
                "timestep_minutes": 60,
            }
        )
        events: list[dict] = []
        while True:
            msg = ws.receive_json()
            events.append(msg)
            if msg["event"] in ("completed", "failed"):
                break
        assert events[0]["event"] == "started"
        final = events[-1]
        assert final["event"] == "completed"
        assert final["result"]["status"] in ("optimal", "optimal_inaccurate")
        assert final["result"]["n_timesteps"] == 6


def test_websocket_invalid_payload_fails(client) -> None:
    with client.websocket_connect("/api/v1/ws/solve") as ws:
        ws.send_json({"network": "no-such-network"})
        msg = ws.receive_json()
        # Either pydantic rejects it (failed) or the network lookup fails
        assert msg["event"] == "failed"
