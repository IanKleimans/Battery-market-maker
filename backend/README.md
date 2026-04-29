# Battery Market Maker — Backend

FastAPI service exposing the SDP solvers, multi-period DC-OPF, and scenario library
that power the Battery Market Maker frontend.

## Endpoints

- `GET  /api/v1/networks` — list available IEEE topologies (5-bus, 14-bus, 30-bus)
- `GET  /api/v1/networks/{name}` — full topology data for one network
- `POST /api/v1/optimization/multiperiod` — multi-period DC-OPF with assets
- `POST /api/v1/sdp/battery` — single-asset battery SDP comparison (PF / Myopic / MPC)
- `POST /api/v1/forecasting/quality` — forecast quality metrics
- `GET  /api/v1/scenarios` — pre-built scenario list
- `GET  /api/v1/scenarios/{id}` — full scenario config
- `WS   /api/v1/ws/solve` — streaming solve progress

OpenAPI docs are at `/docs` (Swagger) and `/redoc`.

## Quickstart

```bash
cd backend
uv sync --extra dev   # or pip install -e ".[dev]"
uv run uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs`.

## Tests

```bash
uv run pytest
```

## Deploy

See `DEPLOY.md` for Railway deploy instructions.
