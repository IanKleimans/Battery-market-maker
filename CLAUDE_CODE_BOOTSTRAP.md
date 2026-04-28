# Claude Code Bootstrap Prompt — IE 590 Final Project

**How to use this file:**
1. Save `IE590_proposal_final.md` to the root of a fresh empty directory.
2. Save THIS file (`CLAUDE_CODE_BOOTSTRAP.md`) to the same directory for reference.
3. Open Claude Code in that directory.
4. Copy-paste everything between the `===== PROMPT BEGINS =====` and `===== PROMPT ENDS =====` markers below as the very first message. Do not add anything else before or after on the first message.

---

===== PROMPT BEGINS =====

You are working with Ian Kleimans on his IE 590 final project at Purdue University. The project is graded by Dr. Andrew L. Liu and is due in approximately 10 days (early May 2026). Ian is a senior in Industrial Engineering with strong applied skills (Amazon Operations Engineering internship, custom DC-OPF simulator already built in JavaScript, working forecasting pipelines in Python). He is shipping this on a tight deadline alongside finals in three other classes. Treat his time as the scarcest resource on this project.

A complete project specification is in `IE590_proposal_final.md` at the root of this repository. It is approximately 7000 words and contains: the SDP formulation, the methods to implement, the data sources, the proposed repository structure (Section 9.5), a Gymnasium environment skeleton (Section 9.3), an SB3 training script (Section 9.4), implementation gotchas (Section 9.6), and the timeline and scope (Sections 11-12).

You MUST read this spec in full before doing anything else.

---

# WORKING AGREEMENTS

These rules govern how you operate throughout this project. Internalize them.

## Autonomy levels

Operate at three different levels of autonomy depending on the task:

- **Level 1 — proceed autonomously.** Scaffolding, formatting, type hints, test boilerplate, package installation, fixing your own bugs, commit messages, refactoring. Just do it; report it in the next checkpoint.

- **Level 2 — proceed and report.** Implementing well-specified algorithms from the spec (perfect-foresight LP, myopic-greedy, MPC), writing tests for those algorithms, generating figures from the data, drafting prose for the report. Do the work, then summarize what you did and any non-trivial decisions you made.

- **Level 3 — STOP and ASK.** Anything that changes scope, anything where the spec is ambiguous, anything involving architectural decisions not covered in the spec, anything where you'd want to deviate from the spec, decisions about what to include or exclude in the report, anything involving real money or proprietary data sources.

When in doubt, escalate to a higher level (i.e., ask). Ian's time is more valuable than yours.

## Checkpoint discipline

After each phase listed below, STOP. Do not proceed to the next phase without Ian's explicit go-ahead. At each checkpoint, give him exactly this:

1. A 5-bullet summary of what you built in the phase.
2. What's tested and what isn't.
3. Any decisions you made that deviate from the spec, and why.
4. What's next, and a time estimate in hours for the next phase.
5. Any blocker requiring his action (e.g., "I need you to download this dataset before I can proceed").

## Quality bars

- Every non-trivial function gets a pytest test. The bar is "could a future maintainer trust that this works?"
- Every module has a docstring at the top explaining what it does and which section of the spec it implements.
- Type hints on all function signatures.
- No silent fallbacks. If data is missing or a config is malformed, raise a clear, named exception.
- LP formulations must reproduce a known synthetic result before being trusted on real data. Always verify on a toy problem first.
- Match the spec's notation in code: `E` for SOC, `c` for charge rate, `d` for discharge rate, `b_reg` for regulation bid capacity, `eta_c`/`eta_d` for charge/discharge efficiency, `kappa` for degradation cost coefficient.
- Use `pandas` for time series, `numpy` for arrays, `cvxpy` for LPs.
- Time stamps are tz-aware. PJM is `America/New_York` (EPT). Internal storage in UTC, display in ET.

## Things you should NOT do

- Do not extend the existing 5-bus DC-OPF simulator's multi-period mode. That is post-semester work, not the May deliverable.
- Do not implement Part B (data center extension). Part B is a written formulation and qualitative discussion in the report; no code.
- Do not implement PPO via Stable-Baselines3 in this round. SB3 is in the spec for the post-semester continuation. For the May submission, MPC is the methodological centerpiece.
- Do not skip writing tests to "save time." On a 10-day timeline, debugging untested code costs more than writing tests would have.
- Do not rewrite or modify `IE590_proposal_final.md`. If you find something in it that needs to change, flag it to Ian; he edits the spec.
- Do not invent data. If real PJM data is unavailable, use the synthetic generator and label every figure as such.
- Do not push to a public remote without Ian's explicit OK.

---

# THE PHASED PLAN

Total budget: 10 days. Realistic distribution given Ian's other coursework:

| Days | Phase | Deliverable |
|------|-------|-------------|
| 1 (today) | Phase 0: Setup and data | Repo scaffolded, synthetic data working, real PJM data downloaded |
| 2-3 | Phase 1: Core LP solvers | Perfect-foresight LP and myopic-greedy on synthetic data, tested |
| 4-5 | Phase 2: Real data + MPC | All three policies on real PJM data, MPC with one forecaster |
| 6-7 | Phase 3: Analysis and figures | Revenue comparison, optimality gap, all report figures |
| 8-9 | Phase 4: Report and slides | 5-10 page report drafted, 10-min slides drafted |
| 10 | Phase 5: Polish and submit | Final review, submission |

## PHASE 0 — Setup and data (today, ~3 hours)

### Phase 0.1 — Environment and repo

1. Verify Python 3.11+ available. If not, tell Ian.
2. Initialize the project with `uv init` (preferred) or `poetry init --no-interaction`. Create `pyproject.toml` with these dependencies:
   - `numpy`, `pandas`, `scipy`, `matplotlib`, `seaborn`, `jupyter`
   - `cvxpy`, `highspy`
   - `statsmodels`, `xgboost`, `scikit-learn`
   - `pytest`, `pytest-cov`
   - Skip for now (post-semester): `stable-baselines3`, `gymnasium`, `chronos-forecasting`, `torch`.
3. Create the directory tree (subset of spec Section 9.5):
   ```
   data/
     pjm/
     processed/
   src/
     forecasting/
     policies/
     eval/
     utils/
   notebooks/
   tests/
   figures/
   report/
   slides/
   ```
4. `.gitignore`: `data/`, `figures/*.png`, `figures/*.pdf`, `__pycache__/`, `.venv/`, `.ipynb_checkpoints/`, `.DS_Store`, `*.pyc`, `report/*.pdf`, `slides/*.pdf`.
5. Initialize git. First commit: "Initial project scaffolding."
6. Write `README.md`: project title, one-paragraph description, quickstart (`uv sync && uv run pytest`), link to the spec file.
7. Add `__init__.py` to each `src/` subdirectory.

### Phase 0.2 — Synthetic data generator (the fallback)

Write `src/utils/synthetic_data.py`:
- `generate_synthetic_lmps(n_days=30, freq_minutes=5, seed=42) -> pd.Series`: produces a tz-aware (UTC) time series at 5-min resolution with daily seasonality (peak around 17:00-19:00 ET), weekly pattern (lower on weekends), occasional spikes (2-3 per week to ~3-5x baseline), Gaussian noise. Mean ≈ $35/MWh, peaks ≈ $80-150, spikes ≈ $300+. Make it realistic enough that arbitrage opportunities exist.
- `generate_synthetic_reg_prices(lmp_series, seed=42) -> pd.DataFrame`: produces a DataFrame with columns `reg_cap_price`, `reg_perf_price`, indexed identically to `lmp_series`. Reg cap prices roughly 0.3-0.5x of LMP magnitude; reg perf prices smaller, with their own variation. Document the model in the docstring.
- Include unit tests in `tests/test_synthetic_data.py` checking shape, index alignment, and that values are non-negative.

### Phase 0.3 — Real PJM data loader (skeleton)

Write `src/utils/pjm_data_loader.py`:
- `load_rt_lmps(filepath: Path, pnode_id: int) -> pd.Series`: reads PJM Data Miner 2 5-min LMP CSV (expected columns: `datetime_beginning_ept`, `pnode_id`, `pnode_name`, `total_lmp_rt`, `congestion_price_rt`, `marginal_loss_price_rt`). Filters to the requested pnode_id, parses datetimes as `America/New_York` then converts to UTC, sorts, returns a Series of `total_lmp_rt`. Forward-fill up to 2 consecutive missing values; raise on more.
- `load_reg_prices(filepath: Path) -> pd.DataFrame`: similar pattern for the regulation market results CSV.
- Skeleton tests in `tests/test_pjm_data_loader.py` using a tiny in-memory CSV.

### Phase 0.4 — Inspection notebook

Write `notebooks/00_data_inspection.ipynb` that:
1. Imports the synthetic generator (and tries the real loader, falling back if file absent).
2. Plots a week of LMPs with hourly mean overlaid.
3. Plots the LMP distribution (histogram + log-scale).
4. Plots the regulation prices.
5. Prints summary stats.

Save figures to `figures/00_data_inspection/`.

### Phase 0.5 — Data sourcing message to Ian

At the end of Phase 0, deliver this exact message to Ian:

> "Phase 0 done. To use real PJM data instead of synthetic, please:
> 1. Go to https://dataminer2.pjm.com (free account required).
> 2. Search for 'Real-Time Five Minute LMPs', set date range to the last 30 days, filter to pnode_id 51288 (WEST HUB) or 51217 (AEP-DAYTON HUB) — your call which.
> 3. Download as CSV, save to `data/pjm/rt_lmps.csv`.
> 4. Same flow for 'Regulation Market Results' → `data/pjm/reg_prices.csv`.
>
> Once those files exist, I'll switch the pipeline from synthetic to real automatically. In the meantime I'll proceed with synthetic data for Phase 1."

**STOP HERE. CHECKPOINT 0.**

## PHASE 1 — Core LP solvers (days 2-3, ~6-8 hours)

### Phase 1.1 — Battery params and types

Write `src/utils/config.py`:
- `BatteryParams` dataclass: `E_max_mwh: float`, `P_max_mw: float`, `eta_c: float = 0.92`, `eta_d: float = 0.92`, `kappa_per_mwh: float = 2.0`, `initial_soc_mwh: float = 50.0`. Validation in `__post_init__`.
- Default instance `DEFAULT_BATTERY = BatteryParams(E_max_mwh=100.0, P_max_mw=50.0)`.

Write `src/policies/types.py`:
- `DispatchResult` dataclass: `schedule: pd.DataFrame` (cols: `c_mw`, `d_mw`, `b_reg_mw`, `E_mwh`, `lmp`, `reward`), `total_revenue: float`, `energy_revenue: float`, `regulation_revenue: float`, `degradation_cost: float`, `solve_time_seconds: float`, `policy_name: str`.

### Phase 1.2 — Perfect-foresight LP

Write `src/policies/perfect_foresight_lp.py` with:

```python
def solve_perfect_foresight(
    lmps: pd.Series,                  # tz-aware UTC
    reg_cap_prices: pd.Series,
    reg_perf_prices: pd.Series,
    battery: BatteryParams,
    dt_hours: float = 5/60,
    rho_assumed: float = 0.95,        # assumed regulation performance score
) -> DispatchResult: ...
```

Formulation per spec Section 3. Decision variables `c[t]`, `d[t]`, `b_reg[t]`, `E[t]` for `t = 0, ..., T-1`. Use cvxpy with HiGHS. Constraints:
- `E[t+1] == E[t] + eta_c * c[t] * dt - d[t] * dt / eta_d` (no reg signal energy delta in this LP since it's zero-mean in expectation)
- `0 <= E[t] <= E_max`
- `0 <= c[t] <= P_max`, `0 <= d[t] <= P_max`
- `c[t] + d[t] <= P_max` (this softens the bilinear no-simultaneous constraint; combined with positive `kappa`, the LP will not charge and discharge simultaneously)
- `0 <= b_reg[t] <= P_max - c[t] - d[t]` (regulation reserves headroom)

Objective: maximize sum over t of `lmp[t] * (d[t] - c[t]) * dt + reg_cap[t] * b_reg[t] * dt + reg_perf[t] * rho_assumed * b_reg[t] * dt - kappa * (c[t] + d[t]) * dt`.

Tests in `tests/test_perfect_foresight.py`:
1. Two-period toy: hour 0 LMP $20, hour 1 LMP $80, no regulation. Verify charge in hour 0, discharge in hour 1, revenue ≈ (80 - 20/eta) * d for some d up to P_max constrained by E_max.
2. Flat-price test: constant LMP, no regulation. Verify zero revenue (no arbitrage opportunity, kappa > 0 disincentivizes cycling).
3. Regulation-only test: zero LMP variation, positive reg cap price. Verify the LP bids regulation up to P_max.

### Phase 1.3 — Myopic-greedy

Write `src/policies/myopic_greedy.py`. Same signature as PF-LP. At each step, optimize that step's reward only, given current SOC. Naturally solvable as a single-period LP per step.

Test in `tests/test_myopic.py`: same two-period toy as above. Verify revenue is no greater than PF-LP. Verify that under monotonically increasing prices, myopic discharges immediately and runs out of energy.

### Phase 1.4 — Smoke test on synthetic data

Write `notebooks/01_phase1_validation.ipynb`:
- Generate 7 days of synthetic data.
- Run PF-LP and myopic-greedy.
- Print revenue numbers and per-component breakdown.
- Plot SOC trajectory and dispatch under each.

**STOP HERE. CHECKPOINT 1.**

## PHASE 2 — Real data and MPC (days 4-5, ~8-10 hours)

### Phase 2.1 — Switch to real data

Once Ian has provided the CSVs:
1. Run PF-LP and myopic-greedy on a 7-day window of real PJM data.
2. Sanity check: PF-LP revenue extrapolated to a year should land in the $50-200/kW-yr range. Wildly off → debug; flag to Ian.
3. Update `00_data_inspection.ipynb` with real data plots.

### Phase 2.2 — XGBoost forecaster

Write `src/forecasting/xgboost_forecaster.py`:
- `XGBoostLMPForecaster` class. Fit on lag features (last 12 LMPs, hour-of-day cyclic encoding sin/cos, day-of-week one-hot). Predicts 1 step ahead.
- Method `predict_horizon(history, horizon_steps)` does iterative prediction: predict t+1, append to history, predict t+2, etc.
- Train/test split: first 80% train, last 20% test. Report RMSE and MAPE on test.

Test in `tests/test_xgboost_forecaster.py`: synthetic AR(1) process; verify the model recovers the autoregressive structure (RMSE < trivial baseline).

### Phase 2.3 — MPC

Write `src/policies/mpc.py`:

```python
def solve_mpc(
    lmps: pd.Series,
    reg_cap_prices: pd.Series,
    reg_perf_prices: pd.Series,
    battery: BatteryParams,
    forecaster: LMPForecaster,         # protocol with predict_horizon method
    horizon_steps: int = 288,           # 24 hours at 5-min steps
    dt_hours: float = 5/60,
) -> DispatchResult: ...
```

Loop: at each step `t`, get forecast for the next `horizon_steps`, solve a deterministic LP over that window using the same formulation as PF-LP but with forecast prices, implement only `(c[0], d[0], b_reg[0])`, advance SOC using realized LMP and the actual decision, repeat.

Tests in `tests/test_mpc.py`:
1. With a "perfect" forecaster (returns true future prices), MPC should match PF-LP revenue to within 1%.
2. With a constant-mean forecaster (predicts the historical mean for everything), MPC should be no worse than myopic-greedy.

### Phase 2.4 — Three-policy comparison

Update `notebooks/01_phase1_validation.ipynb` (rename to `notebooks/02_three_policy_comparison.ipynb`) to run all three policies on the same week of real data, print revenue numbers, plot SOC trajectories side-by-side.

**STOP HERE. CHECKPOINT 2.**

## PHASE 3 — Analysis and figures (days 6-7, ~6-8 hours)

### Phase 3.1 — Benchmark harness

Write `src/eval/benchmark.py`:
- `run_benchmark(data, policies, battery_params) -> pd.DataFrame`: runs each policy on the same data window, returns a DataFrame with columns `policy`, `total_revenue`, `energy_revenue`, `regulation_revenue`, `degradation_cost`, `revenue_per_kw_year`, `optimality_gap`, `runtime_seconds`.
- `optimality_gap = (V_pi - V_greedy) / (V_PF - V_greedy)`. Bounded in [0, 1] by construction; values outside that range indicate a bug.

### Phase 3.2 — The five report figures

Write `src/eval/plots.py` with one function per figure. All figures: 300 dpi, both `.png` and `.pdf`, saved to `figures/`. Use a consistent color scheme. Use matplotlib (no seaborn defaults — explicit style control).

- **Figure 1 — Dispatch overview (3 panels stacked):** for one representative week under PF-LP. Panel A: LMP and SOC over time, dual y-axis. Panel B: charge (positive) and discharge (negative) decisions as a step plot. Panel C: regulation bid capacity over time.
- **Figure 2 — Revenue comparison bar chart:** total revenue for each policy on the test window. Annotate each bar with the dollar value.
- **Figure 3 — Optimality gap vs. forecast horizon:** run MPC at horizons {1, 6, 24, 48, 96, 288} 5-minute steps. X-axis: horizon in hours. Y-axis: optimality gap. Show PF-LP (=1.0) and myopic-greedy (=0.0) as horizontal reference lines.
- **Figure 4 — Revenue decomposition stacked bar:** for each policy, stacked bar showing energy revenue, regulation capacity revenue, regulation performance revenue, minus degradation. One bar per policy.
- **Figure 5 — Forecast error vs. revenue gap scatter:** for the MPC runs at varying horizons, scatter forecast RMSE on x-axis vs. revenue gap (PF-LP minus MPC) on y-axis. Fit and overlay a trend line.

Each figure has a caption written in `figures/captions.md` for direct copy-paste into the report.

### Phase 3.3 — Numerical results table

Write `figures/results_table.md`: a clean markdown table of the numerical results for the report. Same data as the benchmark DataFrame, formatted for inclusion.

**STOP HERE. CHECKPOINT 3.**

## PHASE 4 — Report and slides (days 8-9, ~10-12 hours)

### Phase 4.1 — Report draft

Write `report/IE590_final_report.md`. Target 5-10 pages. Pull heavily from the spec for the formulation, but the results and discussion are new prose grounded in our actual numbers. Structure:

1. **Title page / abstract** (½ page). Title, author, course, date, 150-word abstract.
2. **Introduction** (~1 page). Motivation from spec Section 1. End with research questions.
3. **Background and related work** (~1 page). Pull from spec Sections 5 and 10. Cite Chen et al. 2022, Powell ADP, Schulman et al. PPO, He/Liu/Chen 2025 (Stackelberg). Brief mention of Liu's ADP work for residential energy management.
4. **Problem formulation** (~2 pages). Pull directly from spec Sections 2-3. Include the math. Note Part B as a formulation extension (spec Section 4) without claiming implementation.
5. **Methodology** (~1.5 pages). PF-LP, myopic-greedy, MPC. Reference cvxpy + HiGHS. Briefly mention why SB3-PPO is future work.
6. **Results** (~2 pages). The five figures with prose interpretation. Concrete numbers for revenue, optimality gap, decomposition. Compare to published battery revenue numbers ($114/kW-yr CAISO 2022, etc.) to show our numbers are plausible.
7. **Discussion** (~1 page). What worked, what surprised us, what Part B implementation would change qualitatively, the Stackelberg framing for future work.
8. **Limitations and future work** (~½ page). What we didn't do: full Part B, SB3/PPO, multi-period DC-OPF tab, CAISO sensitivity. Honest about scope.
9. **References**.

Use `pandoc` to render to PDF. Set up the pandoc command in a `Makefile` target `make report`.

### Phase 4.2 — Slides

Write `slides/IE590_final.md` for Marp. 12-15 slides:
1. Title slide.
2. The problem in one picture.
3. Why now? (AI demand + grid flexibility + battery economics)
4. Research questions.
5. SDP formulation — state, action, transition.
6. SDP formulation — reward.
7. Three solution methods.
8. Data: PJM, [time window].
9. Result 1: dispatch overview (Figure 1).
10. Result 2: revenue comparison (Figure 2).
11. Result 3: forecast quality matters (Figure 3, Figure 5).
12. Part B teaser: the data center extension.
13. Limitations.
14. Future work / Stackelberg framing.
15. Thank you / questions.

Marp config: 16:9 widescreen, dark theme is fine but not required. Add `make slides` to the Makefile.

### Phase 4.3 — Polish pass

- Run `pytest --cov=src` and check coverage. Aim for >70% on the policy code.
- All notebooks re-run from clean kernel without errors.
- All figures regenerate from `make figures` (add this Makefile target).

**STOP HERE. CHECKPOINT 4.**

## PHASE 5 — Polish and submit (day 10, ~3-4 hours)

1. Final read-through of the report. Catch typos. Make sure every figure is referenced. Make sure the math renders correctly in PDF.
2. Final run of all tests.
3. Practice timing on the slides — Ian needs to fit in 10 minutes.
4. Tag a release commit: `git tag v1.0-submission`.
5. Tell Ian he's done.

---

# DATA HANDLING NOTES

- **Time zones.** All times in PJM data are EPT (`America/New_York`). Internal pandas Series are tz-aware UTC. Display in figures uses ET for human readability.
- **Units.** LMP is $/MWh. Battery rates are MW. Energy is MWh. Revenue = LMP × power × dt_hours. Be obsessive about unit consistency; one off-by-an-hour in unit conversion has corrupted entire analyses.
- **Missing data.** Forward-fill up to 2 consecutive missing 5-min intervals. Raise `IncompleteDataError` on more.
- **Holidays / DST.** The `America/New_York` zone handles DST automatically; just use it consistently.

---

# WHEN YOU GET STUCK

If you hit something the spec doesn't cover:
1. Re-read the relevant spec section, including Section 9.6 (gotchas).
2. If still stuck, ask Ian. Do not improvise on important decisions.
3. If you've been working on the same bug for >30 minutes of effort, stop and tell Ian what you've tried, what you've ruled out, and what you suspect. Do not let a debugging spiral burn his deadline.

---

# YOUR FIRST ACTION

Right now, do exactly this and only this:

1. Read `IE590_proposal_final.md` in full.
2. Give Ian a 10-bullet summary covering: (a) what the project is, (b) the two parts and the May scope, (c) the three-method comparison plan, (d) the technology stack we're using, (e) the repo structure we'll create, (f) three implementation gotchas you think most likely to bite us, (g) your honest read on the riskiest part of executing this in 10 days, (h) what the Phase 0 deliverable is, (i) what you need from Ian to start (likely: nothing — synthetic data lets you start without real PJM data), (j) anything in the spec that surprised you or that you'd push back on.
3. Ask him exactly one question: "Ready to start Phase 0?"
4. Then WAIT. Do not begin Phase 0 until he says yes.

===== PROMPT ENDS =====
