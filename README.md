# Battery Market Maker

[![Backend tests](https://img.shields.io/badge/backend-37%20tests%20passing-success)]() [![Frontend tests](https://img.shields.io/badge/frontend-56%20tests%20passing-success)]() [![Research tests](https://img.shields.io/badge/research-69%20tests%20passing-success)]() [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)]()

Multi-period DC-OPF for grid-scale batteries, flexible AI data centers, and
renewables on the IEEE 5/14/30-bus test systems. Includes a Stackelberg
market-maker mode that quantifies how a 500 MW campus shifts local LMPs and a
GPU cluster cost calculator that ranks 12 regions by annual electricity cost.
The original IE 590 single-asset SDP research code (Perfect Foresight / MPC /
Myopic) is intact under `src/`.

> **Try it live**
> &nbsp;&nbsp;App: <https://battery-market-maker.vercel.app>
> &nbsp;&nbsp;API: <https://battery-market-maker-production.up.railway.app> · [`/docs`](https://battery-market-maker-production.up.railway.app/docs) · [`/health`](https://battery-market-maker-production.up.railway.app/health)
> &nbsp;&nbsp;Press kit: <https://battery-market-maker.vercel.app/press>

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template) &nbsp; [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## What's new in v3.0

- **Stackelberg / market-maker mode** — third tab in the Pro Simulator. Compares
  a flexible AI campus's revenue under price-taker assumptions vs Stackelberg-aware
  dispatch, with KaTeX-rendered methodology and an MPEC future-work pointer.
- **GPU cluster cost calculator** at `/calculator` — 12 regions, 5 GPU models,
  optional storage / DR revenue, PDF + CSV export, deep-link to the simulator.
- **Show calculations panels** — every result the simulator displays now exposes
  the math behind it: merit-order dispatch, binding constraints, LMP decomposition
  in Live mode; KaTeX objective decomposition + binding-constraint horizon roll-up
  in the Optimization-mode side drawer; per-chart KaTeX equations on the Dashboard.
- **Full Live controls** — tabbed loads / generators / lines / wind panels,
  per-bus / per-gen / per-line overrides, save / load named scenarios in
  `localStorage`, and a Stress Test button that runs a 60-second scripted demo
  (load ramp, line trip, generator outage).
- **Network depth** — drop-shadowed buses, glow auras on active generators
  proportional to dispatch, animated flow arrows on lines with speed-by-magnitude,
  BINDING tag at saturated lines, 60-second LMP sparkline in bus tooltips.
- **Polished landing + footer** — "what you can do" cards, "by the numbers" stats,
  research-question section that names Liu's Stackelberg Markov games, persistent
  footer with live API health ping, last solve latency, and screenshot mode
  (Cmd/Ctrl+Shift+S).
- **Dashboard fixes** — accurate SYNTHETIC PRICES badge (was misleadingly REAL
  PJM), test-window picker with descriptive labels, hover crosshair + final-value
  annotations on the cumulative revenue line, MetricCard deltas, smart empty
  state when a window has no profitable arbitrage.
- **Bug fixes** — null `.toFixed` crashes (root-caused to backend `float("inf")`
  on infeasible solves), Live-mode race conditions hardened with AbortController
  + sequence-token guard + recomputing indicator, top-level React error boundary
  separate from the router-level one.

## Architecture

```
┌──────────────────┐   HTTPS   ┌────────────────────────┐   sys.path   ┌──────────────┐
│  Vercel          │ ────────▶ │  Railway               │ ───────────▶ │  src/        │
│  (React + Vite)  │           │  FastAPI + cvxpy/HiGHS │              │  research    │
│  frontend/       │ ◀──── WS ─┤  backend/              │              │  policies    │
└──────────────────┘           └────────────────────────┘              └──────────────┘
```

* **`backend/`** — FastAPI service: IEEE topologies, multi- and single-period
  DC-OPF (with batteries / AI campuses / renewables), the original SDP comparison,
  scenario library, forecast quality, Stackelberg / market-maker analysis, and a
  WebSocket progress streamer.
* **`frontend/`** — Vite + React 19 + TypeScript + Tailwind. Pro simulator with
  three modes (Live / Optimization / Market Maker), Dashboard with synthetic
  six-window comparison, Calculator with 12-region cost ranking, Press kit.
* **`src/`** — the IE 590 research code (single-battery SDP, XGBoost forecaster,
  benchmarks, plots, PJM data loader). All 69 tests still pass.

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

## Key endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/optimization/multiperiod` | 24-hour DC-OPF with batteries / DCs / renewables |
| `POST /api/v1/optimization/singleperiod` | Live-mode dispatch with per-bus/gen/line overrides |
| `POST /api/v1/optimization/stackelberg` | Market-maker analysis (PT vs SA, gain, LMP impact) |
| `POST /api/v1/sdp/battery` | PF / MPC / Myopic policy comparison on synthetic prices |
| `POST /api/v1/forecasting/quality` | RMSE / MAE / bias of XGBoost / naive / perfect forecasters |
| `GET /api/v1/scenarios` | 10 named demo scenarios |
| `GET /api/v1/networks` | IEEE 5 / 14 / 30 topologies |
| `WS /api/v1/ws/solve` | Streaming solve progress + completion |

## Quickstart — deployed

See `docs/DEPLOY.md`. Two services:

* Backend ⇒ Railway (Dockerfile build, `backend/Dockerfile`).
* Frontend ⇒ Vercel (Vite build, `vercel.json`).

Set `CORS_ORIGINS` on Railway to your Vercel domain, and `VITE_API_BASE_URL` on
Vercel to your Railway URL. Health check: `GET /health`.

## Roadmap

- [x] **v1.0.0** — single-asset SDP comparison, 68 tests, report PDF
- [x] **v2.0.0-backend** — FastAPI backend, multi-period DC-OPF, WebSocket
- [x] **v2.1.0-frontend-shell** — Vite + React + TS + Tailwind shell
- [x] **v2.2.0-pro-simulator** — D3 simulator with optimization mode
- [x] **v2.3.0-dashboard** — SDP comparison dashboard + real PJM 2026 data
- [x] **v2.4.0-polish** — landing, About with KaTeX, docs, accessibility
- [x] **v2.5.0-light-mode** — designed light palette
- [x] **v2.5.1-dashboard-fix** — accurate badge, deltas, annotations, empty state
- [x] **v2.5.2-bug-fixes** — null `.toFixed` crashes + race condition hardening
- [x] **v2.5.3-show-calculations** — Live + Optimization + Dashboard math panels
- [x] **v2.5.4-live-controls-full** — tabbed Live controls + save/load + Stress Test
- [x] **v2.5.5-network-polish** — flow arrows, BINDING tags, LMP sparklines
- [x] **v2.6.0-cost-calculator** — GPU calculator at /calculator
- [x] **v2.7.0-stackelberg** — Market-maker mode (iterative best-response)
- [x] **v2.8.0-polish** — landing rewrite, footer status bar, screenshot mode
- [x] **v2.9.0-content** — About personal section, /press kit, OG meta tags
- [x] **v3.0.0** — production smoke test, regenerated report + slides
- [ ] **future** — full MPEC reformulation, multi-agent campuses, learning-based
  Stackelberg with PPO, Stackelberg Markov game integration of Liu et al. (2025)

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

Dark by default; the header sun/moon toggle switches to a fully designed light
palette (off-white background, white surfaces, slate-900 text). Charts re-tint
axis labels and gridlines; data colors stay constant so figures remain comparable
across modes. Choice persists in `localStorage` and respects `prefers-color-scheme`
on first visit. 200 ms transitions, scoped to the switching event so component
hover transitions stay crisp.

## Data

The simulator's Live and Optimization modes auto-detect real PJM data from
`data/pjm/rt_lmps.csv` (Data Miner 2 export). The SDP dashboard endpoint always
uses a seeded synthetic price generator (six reproducible test windows) so the
comparison is consistent across visits. Tests never silently fall back.

Current PJM corpus: **AEP-DAYTON HUB** (pnode 34497127), 5-min RT LMPs and PJM
RTO regulation clearing prices, March 28 – April 27, 2026.

## Cite this project

```bibtex
@misc{kleimans2026battery,
  author = {Kleimans, Ian},
  title  = {Battery Market Maker: Stochastic Dynamic Programming for
            Grid-Scale Battery Co-Optimization},
  year   = {2026},
  howpublished = {\url{https://battery-market-maker.vercel.app}},
  note   = {IE 590 final project, Purdue Industrial Engineering,
            advised by Dr. Andrew L. Liu}
}
```

## License

MIT — see [`LICENSE`](LICENSE). Cite PJM Interconnection for the underlying data
and the references in `report/IE590_final_report.md` for the methodology.
