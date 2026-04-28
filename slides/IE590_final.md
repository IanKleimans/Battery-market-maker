---
marp: true
theme: default
paginate: true
size: 16:9
header: 'IE 590 Final Project — May 2026'
footer: 'Ian Kleimans · Purdue University'
style: |
  section { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; }
  h1 { color: #1f4e79; }
  h2 { color: #1f4e79; border-bottom: 2px solid #1f4e79; padding-bottom: 4px; }
  table { font-size: 0.9em; }
---

<!-- _class: lead -->

# Stochastic Dynamic Programming for Grid-Scale Battery Co-Optimization

### Comparing perfect-foresight LP, myopic-greedy, and MPC on PJM data

Ian Kleimans · IE 590 · Dr. Andrew L. Liu · Purdue University · May 2026

---

## The problem

A 100 MWh / 50 MW grid-scale battery in PJM:

- Bid into the **real-time energy** market (LMP arbitrage)
- Bid into the **frequency-regulation A** market (capacity + performance)
- Subject to **SOC**, **power-limit**, **round-trip-efficiency**, and **degradation** constraints

Every 5 minutes, allocate $(c_t, d_t, b^{\text{reg}}_t)$ to maximise net revenue
**without knowing future prices**.

---

## Why now?

- Storage is the **fastest-growing** grid asset in the US (CAISO: +500% installed
  capacity 2020→2024)
- Co-optimisation between energy + ancillary services is the source of most of the
  revenue (regulation alone is ~50% of value in many ISOs)
- Forecast quality is the binding constraint, not solver capability
  (we will quantify this in Figure 5)

---

## Research questions

1. How much value does foresight add over a single-step myopic policy?
2. How fast does MPC's optimality gap close as the horizon grows from 1 → 288 steps?
3. Is the residual gap **forecast-limited** or **solver-limited**?
4. How does revenue split between energy / regulation / degradation by policy?

---

## SDP — state, action, transition

**State** $S_t = (E_t, \mathbf{p}^{\text{LMP}}_{t-12:t}, \mathbf{p}^{\text{reg}}_{t-12:t},
\sin\phi_t, \cos\phi_t, \mathbf{w}_t)$

**Action** $a_t = (c_t, d_t, b^{\text{reg}}_t)$, all $\geq 0$, with
$c_t + d_t + b^{\text{reg}}_t \leq P^{\max}$

**Transition** $E_{t+1} = E_t + \eta_c c_t \Delta t - d_t \Delta t / \eta_d$,
clipped to $[0, E^{\max}]$

---

## SDP — reward

$$r_t = \lambda^{\text{LMP}}_t (d_t - c_t)\Delta t
       + \lambda^{\text{reg,cap}}_t b^{\text{reg}}_t \Delta t
       + \lambda^{\text{reg,perf}}_t \rho\, b^{\text{reg}}_t \Delta t
       - \kappa(c_t + d_t)\Delta t$$

Three streams:
- **Energy** arbitrage (sign of $d - c$)
- **Regulation** capacity + performance
- **Degradation** cost (per-MWh throughput)

Defaults: $E^{\max}=100$ MWh, $P^{\max}=50$ MW, $\eta=0.92$, $\kappa=\$2$/MWh,
$\rho=0.95$, $\Delta t=5/60$ h.

---

## Three solution methods

| Method | What it sees | Role |
|---|---|---|
| **Perfect-foresight LP** | All future prices | **Upper bound** |
| **Myopic-greedy** | Only the current step | **Lower bound** |
| **MPC + XGBoost** | Forecast over $H$ steps | Implementable controller |

PF-LP and MPC use **cvxpy + HiGHS**. Myopic enumerates LP vertices analytically
(<1 ms / step).

---

## Data

- **PJM Data Miner 2** five-min RT LMPs (when available) + RegA cap/perf prices
- Loader handles ET → UTC, ≤2-step forward fill, raises on longer gaps
- **Synthetic fallback**: daily seasonality (peak 17–19 ET), weekend dip,
  2–3 spikes / week to 3–5× baseline, mean ≈ \$35/MWh
- Figures clearly labelled "Real PJM data" or "Synthetic data (illustrative)"

---

## Result 1 — Dispatch trajectory (PF-LP, one week)

![h:480](../figures/fig1_dispatch_overview.png)

PF-LP charges overnight, discharges 17–19 ET, holds reg bid in unused headroom.

---

## Result 2 — Revenue + decomposition

<div style="display:flex; gap:1em;">

![w:520](../figures/fig2_revenue_comparison.png)
![w:520](../figures/fig4_revenue_decomposition.png)

</div>

PF-LP wins energy; myopic still wins on regulation; MPC sits in between.

---

## Result 3 — MPC convergence and forecast sensitivity

<div style="display:flex; gap:1em;">

![w:520](../figures/fig3_gap_vs_horizon.png)
![w:520](../figures/fig5_rmse_vs_gap.png)

</div>

Gap closes by $H \approx 96$ (8 h). Residual gap is monotone in forecaster RMSE
→ **forecast-limited**.

---

## Part B teaser — Behind-the-meter data centre

A hyperscale DC + co-located battery is a **bilevel** problem:

- **Leader** (data centre): chooses load profile to minimise total energy bill
- **Follower** (battery): reacts with dispatch to minimise leader's net spend

Following He, Liu, Chen (2025), the follower's reaction is **piecewise linear**
in the leader's schedule, which lets the leader's MIP collapse to a single linear
constraint per period.

(Qualitative section in this report; full implementation is the post-semester
Part B extension.)

---

## Limitations

- Forecaster only sees **own price history** — no load, weather, gas, reserve
- Marginal $\kappa$ is a coarse proxy for cell-level degradation
- Risk-neutral objective; CVaR / robust counterparts are an obvious extension
- Single-node LMP — no congestion-driven uplift
- Synthetic data calibrated to PJM, not validated on a held-out real season

---

## Future work

1. **Full Part B** bilevel MIP for data-centre + battery
2. **PPO** via Stable-Baselines3 over the same Gymnasium env
3. **Multi-period DC-OPF** settlement using the existing 5-bus simulator
4. **CAISO sensitivity** to test transferability of the MPC controller
5. **Stackelberg** sensitivity to leader penalty weights

---

<!-- _class: lead -->

## Thank you

Code, tests, figures, and this deck are reproducible from `make all`.

Questions?

Ian Kleimans · `kleimans@purdue.edu`
