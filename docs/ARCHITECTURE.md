# Architecture

## Repo layout

```
ie590-project/
├── src/                  # IE 590 research code (single-asset SDP)
│   ├── policies/         # PF-LP, MPC, Myopic
│   ├── forecasting/      # XGBoost LMP forecaster
│   ├── eval/             # benchmark + plot generators
│   └── utils/            # synthetic data, PJM loader, BatteryParams
├── backend/              # FastAPI service (deployed to Railway)
│   ├── app/
│   │   ├── main.py       # app + middleware + routers
│   │   ├── core/         # settings (env-driven)
│   │   ├── routers/      # network / optimization / sdp / forecasting / scenarios
│   │   ├── schemas/      # Pydantic models — single source of truth
│   │   ├── network/      # IEEE 5/14/30-bus topologies + layouts
│   │   ├── solvers/      # cvxpy multi/single-period DC-OPF + SDP wrapper
│   │   ├── scenarios/    # 10-scenario library
│   │   └── ws/           # WebSocket solve progress
│   └── tests/            # 30 pytest tests via FastAPI TestClient
├── frontend/             # Vite + React 19 + TS + Tailwind (deployed to Vercel)
│   └── src/
│       ├── api/          # typed REST + WS clients
│       ├── components/   # ui/ + layout/ + network/
│       ├── hooks/        # useSolveSimulator, useFrameState, useLiveDispatch, …
│       ├── pages/        # Landing, Pro, Classic, Dashboard, Scenarios, About
│       ├── store/        # Zustand simulator store
│       ├── types/        # API type mirrors
│       └── routes/       # react-router-dom config
├── data/pjm/             # gitignored — real PJM CSVs go here
├── notebooks/            # research notebooks
├── report/               # IE590_final_report.{md,pdf}
└── slides/               # Marp deck
```

## Data flow — Pro simulator optimization mode

```
User clicks "+ Battery" → store.placementMode = 'battery'
User clicks bus 9       → store.batteries.push({ id, bus: 9, defaults… })
User clicks "Optimize"  → useSolveSimulator()
  ↳ ws://…/api/v1/ws/solve  (sends MultiPeriodRequest)
  ↳ backend builds cvxpy LP, solves with HiGHS
  ↳ "completed" event → store.multiResult = MultiPeriodSolution
  ↳ scrubberStep = 0
useFrameState(result, network, step) → FrameState
  ↳ NetworkDiagram re-renders bus colors (LMP), line widths (flow), gen sizes,
    asset glyphs (SOC fill, DC bars, renewable rotor)
  ↳ ResultsPanel re-renders Dispatch/Storage/Prices/Revenue tabs
TimeScrubber drag/play → store.scrubberStep updates → all visuals follow
```

## Multi-period DC-OPF

See `backend/app/solvers/multiperiod_opf.py`. Key design decisions:

* **All variables on the LHS of nodal balance.** This makes the dual sign
  consistent across every (t, bus): `LMP = -dual_value`. With load on the LHS
  inside `gen_sum - load`, cvxpy canonicalizes inconsistently for buses that
  have no generators.
* **Joint LP, not stagewise.** A 24-hour horizon at 1-hour resolution on
  IEEE-14 with 2 batteries + 1 DC is ≈ 3 k variables and solves in <1 s.
  At 5-min resolution it's ≈ 36 k variables and still solves in a few seconds.
* **Soft single-direction.** Charge + discharge are nonnegative; a degradation
  cost `kappa * (c + d)` makes simultaneous charging suboptimal whenever
  `kappa > 0`. No mixed-integer.

## Topology layouts

Hand-tuned in `backend/app/network/topologies.py`. The standard published
diagrams of IEEE 14 and IEEE 30 don't read well in a 1200×800 viewport, so we
laid out buses in three voltage tiers (left-to-right) for IEEE-14, and a 6×5
grid for IEEE-30.

## State management

The frontend uses Zustand (`subscribeWithSelector` middleware). Components
select the slices they need; mutations are method calls on the store rather
than reducers. Store-level invariants:

* Switching network clears all placed assets (bus IDs differ).
* Loading a scenario replaces all asset state and resets the scrubber.
* `solving` is mutually exclusive with `multiResult` rendering — overlay locks
  the network diagram until a "completed" event arrives.

## Tests

* **Research** (`tests/`): 69 pytest tests covering config, synthetic data,
  PJM loader (with both pre-2025 and post-2025 reg-price schemas), all three
  policies, the XGBoost forecaster, and the benchmark + plot pipeline.
* **Backend** (`backend/tests/`): 30 pytest tests via `fastapi.testclient`.
  Hits every route, validates LMP signs, runs every pre-built scenario through
  the multi-period OPF, exercises the WebSocket happy path and a failure path.
* **Frontend** (`frontend/src/**/__tests__/`): 11 vitest tests covering Button,
  format helpers, and the Zustand store actions.
