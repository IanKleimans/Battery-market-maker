# Battery Market Maker

[![Backend tests](https://img.shields.io/badge/backend-30%20tests%20passing-success)]() [![Frontend tests](https://img.shields.io/badge/frontend-15%20tests%20passing-success)]() [![Research tests](https://img.shields.io/badge/research-69%20tests%20passing-success)]() [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)]()

Interactive multi-period DC-OPF for grid-scale batteries, flexible AI data centers,
and renewables on the IEEE 5/14/30-bus test systems — with the original IE 590
research code (Perfect Foresight / MPC / Myopic single-asset SDP) intact under
`src/`.

> **Try it live**
> &nbsp;&nbsp;App: <https://battery-market-maker.vercel.app>
> &nbsp;&nbsp;API: <https://battery-market-maker-production.up.railway.app> · [`/docs`](https://battery-market-maker-production.up.railway.app/docs) · [`/health`](https://battery-market-maker-production.up.railway.app/health)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template) &nbsp; [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## Architecture

```
┌──────────────────┐   HTTPS   ┌────────────────────────┐   sys.path   ┌──────────────┐
│  Vercel          │ ────────▶ │  Railway               │ ───────────▶ │  src/        │
│  (React + Vite)  │           │  FastAPI + cvxpy/HiGHS │              │  research    │
│  frontend/       │ ◀──── WS ─┤  backend/              │              │  policies    │
└──────────────────┘           └────────────────────────┘              └──────────────┘
```

* **`backend/`** — FastAPI service exposing IEEE topologies, multi- and single-period
  DC-OPF (with batteries / AI campuses / renewables), the original SDP comparison,
  scenario library, forecast quality, and a WebSocket progress streamer.
* **`frontend/`** — Vite + React 19 + TypeScript + Tailwind. The Pro simulator is
  a three-panel optimization workspace; the Classic simulator preserves the original
  vanilla-JS 5-bus visual via iframe; the Dashboard is the SDP comparison view.
* **`src/`** — the IE 590 research code (single-battery SDP, XGBoost forecaster,
  benchmarks, plots, PJM data loader). All 69 tests still pass.

## What's in here

* **Research code** — three single-asset dispatch policies (`src/policies/`),
  XGBoost forecaster, benchmark runner, five figures, full report + slides.
* **Backend API** — typed FastAPI routes for everything the simulator needs:
  multi-period DC-OPF with cvxpy + HiGHS, LMPs from constraint duals,
  scenario library (10 named scenarios), WebSocket solve progress.
* **Pro simulator** — D3-rendered IEEE 14- and 30-bus diagrams with click-to-place
  asset workflow, time scrubber, four results tabs (Dispatch / Storage / Prices /
  Revenue), Framer Motion animations, Recharts visualizations.
* **Real PJM data** — auto-detected when `data/pjm/rt_lmps.csv` is present;
  current corpus is AEP-DAYTON HUB, Mar 28 – Apr 27 2026, 5-min resolution
  (≈8.9k LMP rows + 8.4k regulation-price rows).

## Quickstart — local

```bash
# Backend
cd backend
uv sync --extra dev
uv run uvicorn app.main:app --reload --port 8000  # serves /api/v1 + /docs

# Frontend (in a second shell)
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxies /api → :8000)

# Research code (existing)
cd ..
uv run pytest --cov=src
```

## Quickstart — deployed

See `docs/DEPLOY.md`. Two services:

* Backend ⇒ Railway (Dockerfile build, `backend/Dockerfile`).
* Frontend ⇒ Vercel (Vite build, `vercel.json`).

Set `CORS_ORIGINS` on Railway to your Vercel domain, and `VITE_API_BASE_URL` on
Vercel to your Railway URL. Health check: `GET /health`.

## Roadmap

- [x] **v1.0.0** — single-asset SDP comparison, 68 tests, report PDF
- [x] **v2.0.0-backend** — FastAPI backend, multi-period DC-OPF, WebSocket
- [x] **v2.1.0-frontend-shell** — Vite + React + TS + Tailwind shell, design system
- [x] **v2.2.0-pro-simulator** — D3 simulator with optimization mode
- [x] **v2.3.0-dashboard** — SDP comparison dashboard + real PJM 2026 data
- [x] **v2.4.0-polish** — landing, About with KaTeX, docs, accessibility
- [x] **v2.5.0-light-mode** — light/dark theme toggle, designed (not inverted) light palette
- [x] **v3.0.0-deployed** — Railway + Vercel

## Math notation in code

| Symbol      | Variable   | Meaning                                              |
|-------------|------------|------------------------------------------------------|
| `E_{k,t}`   | `E`        | State of charge of battery k at time t (MWh)         |
| `c, d`      | `c, d`     | Charge / discharge power (MW)                        |
| `b_reg`     | `b_reg`    | Regulation capacity bid (MW, single-asset SDP)       |
| `f_{l,t}`   | `f`        | Line flow (MW), positive = `from → to`               |
| `θ_{b,t}`   | `theta`    | Bus voltage angle (rad)                              |
| `λ_{b,t}`   | `lmp`      | LMP at bus b, time t ($/MWh) — dual of nodal balance |
| `u_{j,t}`   | `u`        | Data-center utilization fraction                     |
| `ξ_{r,t}`   | `curtail`  | Renewable curtailment fraction                       |

## Theme

Dark by default, but can be switched to light mode using the sun/moon toggle in the header switches to a fully designed light
palette (off-white background, white surfaces, slate-900 text) — not just an
inverted dark theme. Charts re-tint axis labels and gridlines for readability;
data colors stay constant so figures remain comparable across modes. The choice
persists in `localStorage` and respects `prefers-color-scheme` on first visit.
Switch transitions are 200ms across `bg-color`, `border-color`, `color`, `fill`,
and `stroke`, scoped to the switching event so component hover transitions stay
crisp.

## Data

When `data/pjm/rt_lmps.csv` is present (PJM Data Miner 2 export), the loader is
used and figures are labeled with the pnode name. Otherwise a calibrated synthetic
generator is used and figures are clearly labeled as synthetic. Tests never silently
fall back.

Current corpus: **AEP-DAYTON HUB** (pnode 34497127), 5-min RT LMPs and PJM RTO
regulation clearing prices, March 28 – April 27, 2026.

## License

MIT — see [`LICENSE`](LICENSE). Cite PJM Interconnection for the underlying data
and the references in `report/IE590_final_report.md` for the methodology.
