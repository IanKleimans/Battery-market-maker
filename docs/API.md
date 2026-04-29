# API reference

The backend exposes a typed REST API plus one WebSocket endpoint. Run the
service locally and visit `/docs` for the live Swagger UI generated from the
Pydantic schemas — this document is a narrative companion.

## Conventions

- Base URL: `https://api.<your-domain>/api/v1` in production, `http://localhost:8000/api/v1` in dev.
- All POST bodies are JSON; all responses are JSON.
- Errors: `{ "detail": <string|object> }` with appropriate HTTP status.
- Validation errors use FastAPI's standard `422` format.

## Networks

### `GET /networks`
List the three topologies.
```json
[
  { "name": "bus5", "display_name": "5-Bus Classic", "n_buses": 5, "n_lines": 6, "n_generators": 5, "description": "…" },
  { "name": "ieee14", … },
  { "name": "ieee30", … }
]
```

### `GET /networks/{name}`
Full topology — `buses`, `lines`, `generators`, `loads`, plus the layout coordinates used by the frontend SVG.

## Optimization

### `POST /optimization/multiperiod`
Body: `MultiPeriodRequest` — network, horizon, timestep, asset lists, forecast spec.

Response: `MultiPeriodSolution` — per-timestep dispatch, line flows, LMPs, SOC trajectories, DC utilization, renewable curtailment, per-asset revenue breakdown.

Solves a deterministic multi-period DC-OPF in cvxpy + HiGHS. LMPs are recovered from constraint duals; the sign convention is `LMP = -dual_value` (variables on LHS).

### `POST /optimization/singleperiod`
Body: `SinglePeriodRequest` — network, load multiplier, wind availability, optional line capacity overrides.

Response: `SinglePeriodSolution` — dispatch, line flows, utilization, LMPs, loads. Used by the Live mode for slider-driven recomputation (debounced 120 ms).

## SDP comparison

### `POST /sdp/battery`
Body: which policies (`perfect_foresight` / `myopic_greedy` / `mpc`), battery params, horizon, MPC horizon, forecast type, seed.

Response: `SDPResponse` — schedules and revenues for each requested policy, with timestamps shared across policies.

## Forecast quality

### `POST /forecasting/quality`
Body: forecast type, horizon, sample count, seed.

Response: actual vs forecast arrays plus RMSE / MAE / bias.

## Scenarios

### `GET /scenarios`
Lightweight list (id, title, short description, network, tags).

### `GET /scenarios/{id}`
Full scenario including `key_insight` and a `MultiPeriodRequest` config block ready to POST to `/optimization/multiperiod`.

## WebSocket

### `WS /ws/solve`
Client sends a single JSON message matching `MultiPeriodRequest`.
Server emits a sequence of events:

```json
{ "event": "started", "ts": 0 }
{ "event": "heartbeat", "elapsed": 1.2, "phase": "solving" }
{ "event": "completed", "elapsed": 2.3, "result": MultiPeriodSolution }
```

On error: `{ "event": "failed", "error": <string|validation-list> }`.

Heartbeats fire every 0.5 s while the solve is in flight. cvxpy doesn't expose iteration progress, so heartbeats indicate liveness only.

## Health

- `GET /health` — Railway health-check target. Returns `{"status":"ok"}`.
- `GET /api/v1/health` — same, scoped to the API prefix.

## Rate limits

None enforced server-side. The frontend debounces single-period calls to 120 ms.
