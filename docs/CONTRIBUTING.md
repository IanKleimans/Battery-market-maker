# Contributing

## Local setup

```bash
# Backend
cd backend && uv sync --extra dev
uv run uvicorn app.main:app --reload --port 8000

# Frontend (separate shell)
cd frontend && npm install
npm run dev    # http://localhost:5173

# Research code (separate shell)
cd ie590-project && uv run pytest --cov=src
```

## Style

* Python — `ruff` + `pytest`. Type hints everywhere.
* TypeScript — strict mode on, no `any` without a comment, `prettier --write` before commit.
* React — function components, named exports, `forwardRef` only when the consumer needs the ref.

## Tests

Each PR should include tests for new behavior. The bar is rough proportionality:

* New API endpoint → new test in `backend/tests/`.
* New solver feature → new test in `backend/tests/test_solver_handverified.py` (small hand-verifiable case).
* New React component with logic → vitest test next to it under `__tests__/`.

## Conventions

* **API schemas live in `backend/app/schemas/`**. The frontend mirrors them in `frontend/src/types/api.ts`. Update both in the same PR.
* **Topology layouts** are hand-tuned. Don't replace the published IEEE diagrams — improve the existing layout in place.
* **No silent fallbacks** in research code. If real PJM data is missing, raise a clear error or fall through to the synthetic generator with a logged label, never both quietly.

## Releases

Tag with `v<major>.<minor>.<patch>` after meaningful work. Tags so far:

* `v1.0.0` — research code complete, 68 tests passing
* `v2.0.0-backend` — FastAPI backend
* `v2.1.0-frontend-shell` — frontend bootstrap
* `v2.2.0-pro-simulator` — Pro simulator with optimization mode
* `v2.3.0-dashboard` — analysis dashboard + real PJM 2026 data
* `v2.4.0-polish` — landing, About, docs, accessibility
* `v3.0.0-deployed` — live on custom domain

## License

MIT.
