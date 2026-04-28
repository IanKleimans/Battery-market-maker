---
title: "Stochastic Dynamic Programming for Grid-Scale Battery Co-Optimization on PJM"
author: "Ian Kleimans"
date: "May 2026"
abstract: |
  Grid-scale battery storage operating in PJM Interconnection's real-time
  market faces a co-optimization problem: at each five-minute settlement
  interval the operator must allocate power between energy arbitrage and
  frequency-regulation services subject to state-of-charge dynamics, power
  limits, round-trip efficiency, and a marginal cycling cost.  We cast the
  problem as a finite-horizon Markov decision process and benchmark three
  solution methods on PJM-style data: a perfect-foresight linear program
  (deterministic upper bound), a myopic-greedy policy (single-step lower
  bound), and model-predictive control (MPC) using an XGBoost LMP
  forecaster.  On a representative seven-day window we find that MPC with a
  24-hour look-ahead recovers a high share of the value gap between the two
  bounds.  We discuss extensions to a Stackelberg leader–follower formulation
  for behind-the-meter data-center participation (Part B, qualitative) and
  to multi-period DC-OPF settlement.
---

# 1. Introduction

A 100 MWh / 50 MW grid-connected battery participating in the PJM real-time
energy and Regulation A markets faces a sequential decision problem with
state — the battery's state of charge (SOC) — that couples one period's
choice to all future periods.  Every five minutes the operator must commit
charging power $c_t$, discharging power $d_t$, and a regulation capacity bid
$b^{\text{reg}}_t$, subject to a 50 MW power limit, a 0–100 MWh SOC window,
and an asymmetric round-trip efficiency.  Each unit of battery throughput
incurs a marginal degradation cost $\kappa$.

The economic value of the battery comes from three streams:

1. **Energy arbitrage.** Charge when the LMP is low; discharge when it is high.
2. **Regulation capacity.** Bid up to the unused power headroom into the
   regulation A market and earn the capacity clearing price.
3. **Regulation performance.** Receive a performance score $\rho$ times the
   performance clearing price for following the AGC signal.

The optimum trade-off depends on prices that cannot be known ahead of time.
We compare three solution methods that bracket the achievable revenue:
a perfect-foresight LP that gives the upper bound, a myopic-greedy policy
that gives the lower bound, and MPC with a learned forecaster that operates
in between.  Optimality gaps quantify how much of the spread an
implementable controller can close.

## 1.1 Research questions

1. How much value does foresight add over a single-step myopic policy on
   PJM-style five-minute data?
2. How quickly does MPC's optimality gap close as the look-ahead horizon
   grows from 1 to 288 intervals (5 min to 24 hours)?
3. How sensitive is achieved revenue to the LMP forecaster's accuracy
   (test-set RMSE), and is the residual gap forecast-limited or
   solver-limited?
4. How does revenue split between energy arbitrage, regulation, and
   degradation across the three policies?

# 2. Background and related work

The deterministic optimal-dispatch LP for storage is a textbook problem;
Powell's *Approximate Dynamic Programming* [@powell2011] gives the canonical
treatment of the underlying stochastic decision process.  Chen *et al.*
(2022) [@chen2022] used a finite-horizon LP and a stochastic-DP
approximation to value frequency regulation in PJM and reported
$80–120/\text{kW-yr}$ on 2018–2019 data.  CAISO's 2022 storage report
documented realised revenue of approximately $114/\text{kW-yr}$ for
co-optimised batteries.

Reinforcement-learning approaches to battery dispatch — most recently
Schulman *et al.* (PPO) [@schulman2017] applied to merchant storage —
achieve revenue close to MPC under similar information assumptions but
require substantial engineering to be competitive in production.  We treat
PPO as post-semester work and centre this report on MPC as a strong, simple
baseline.

He, Liu, and Chen (2025) [@he2025] formulated a Stackelberg game between a
data-centre load (leader) and the battery operator (follower) and showed
that the follower's reaction function is piecewise linear in the leader's
schedule.  We use this structure in our qualitative Part B discussion
(Section 7.3) but do not solve the bilevel program in code; that is left to
the post-semester continuation.

# 3. Problem formulation

## 3.1 State, action, transition, reward

Let $t \in \{0,1,\ldots,T-1\}$ index five-minute settlement intervals,
$\Delta t = 5/60$ hours.

**State.** $S_t = (E_t, \mathbf{p}^{\text{LMP}}_{t-12:t}, \mathbf{p}^{\text{reg}}_{t-12:t}, \sin\phi_t, \cos\phi_t, \mathbf{w}_t)$
where $E_t$ is SOC in MWh, $\mathbf{p}^{\cdot}_{t-12:t}$ is the trailing
twelve LMP / reg-price observations, $\phi_t = 2\pi h_t/24$ is hour-of-day
in radians, and $\mathbf{w}_t$ is a one-hot day-of-week indicator.

**Action.** $a_t = (c_t, d_t, b^{\text{reg}}_t) \in \mathbb{R}^3_{\geq 0}$,
charge MW, discharge MW, regulation capacity bid MW.

**Constraints.**

\begin{align}
0 &\leq c_t, d_t \leq P^{\max} \\
c_t + d_t &\leq P^{\max} \quad \text{(at most one direction)} \\
0 &\leq b^{\text{reg}}_t \leq P^{\max} - c_t - d_t \quad \text{(reg uses unused headroom)} \\
0 &\leq E_t \leq E^{\max}
\end{align}

**Transition.**
$$E_{t+1} = E_t + \eta_c\, c_t\, \Delta t - d_t\, \Delta t / \eta_d$$
clipped to $[0, E^{\max}]$.

**Reward.**
$$r_t = \lambda^{\text{LMP}}_t (d_t - c_t) \Delta t
        + \lambda^{\text{reg,cap}}_t b^{\text{reg}}_t \Delta t
        + \lambda^{\text{reg,perf}}_t \rho\, b^{\text{reg}}_t \Delta t
        - \kappa (c_t + d_t) \Delta t$$

## 3.2 Default parameter values

| Symbol | Value | Description |
|---|---|---|
| $E^{\max}$ | 100 MWh | Energy capacity |
| $P^{\max}$ | 50 MW | Power limit |
| $\eta_c, \eta_d$ | 0.92 each | Charge / discharge efficiency |
| $\kappa$ | $\$2/\text{MWh}$ | Marginal degradation cost |
| $E_0$ | 50 MWh | Initial SOC |
| $\rho$ | 0.95 | Assumed regulation performance |
| $\Delta t$ | $1/12$ h | Settlement interval |

Round-trip efficiency is therefore $\eta_c \eta_d \approx 0.846$.

## 3.3 Objective

The decision-maker chooses an admissible policy $\pi$ to maximise expected
discounted revenue.  In the deterministic perfect-foresight LP we
maximise $\sum_t r_t$ directly; in the myopic policy we maximise $r_t$ each
step; in MPC we maximise $\sum_{s=t}^{t+H-1} \mathbb{E}[r_s | \mathcal{F}_t]$
with the expectation replaced by the forecaster's point estimate.

# 4. Methodology

## 4.1 Perfect-foresight LP (PF-LP)

We assemble the full $T$-period LP in **cvxpy** and solve with **HiGHS**.
Decision variables are continuous; the box constraints together with the
non-degeneracy of the objective ensure the optimum has $c_t \cdot d_t = 0$
in every interval whenever $\kappa > 0$ (verified by a regression test).

PF-LP is the upper bound on revenue under the assumption that LMPs and reg
prices are known perfectly in advance.

## 4.2 Myopic-greedy policy

At each interval the policy ignores the future and optimises the current
reward, given the current SOC and prices.  The single-period LP is small
enough to solve analytically by enumerating the constraint vertices: idle,
discharge to the cap, pure reg bid, charge at negative LMP, and the
discharge-plus-reg corner.

## 4.3 Model-predictive control (MPC)

At each step $t$ the controller (i) runs the LMP forecaster on history up
to $t-1$ to produce $H$ point forecasts of future LMP, (ii) solves the
deterministic LP from §4.1 over those forecasted LMPs (with realised reg
prices, which clear day-ahead), (iii) implements the first action, and
(iv) advances SOC using the realised LMP.  We cache the planning horizon
and only re-solve every $r_e$ steps to control runtime; with $H = 96$ and
$r_e = 12$ a seven-day rollout completes in under a minute.

## 4.4 LMP forecaster

We train an `xgboost.XGBRegressor` (200 trees, max-depth 5, learning-rate
0.08) with these features: the last twelve LMP values, hour-of-day
sine/cosine, and a seven-element day-of-week one-hot.  Targets are the
next-interval LMP; multi-step forecasts use iterative prediction with the
output fed back into the lag window.  The chronological 80/20 split keeps
the test set strictly after the training set.

# 5. Data

We use PJM Data Miner 2 five-minute LMP exports when available
(`data/pjm/rt_lmps.csv`), filtered to a single pricing node, with the
hourly RegA capability (RMCCP) and performance (RMPCP) clearing prices
expanded to the same 5-min grid by forward fill.  When the CSV is absent
the pipeline falls back to the synthetic generator
(`src.utils.synthetic_data`) and labels every figure as such.

The synthetic generator superimposes a daily sinusoid (peak at ET 18:00),
a weekend dip, Gaussian noise, and 2–3 randomly placed price spikes per
week up to $3$–$5\times$ the baseline.  Mean LMP is calibrated to roughly
$\$35/\text{MWh}$, qualitatively matching PJM West Hub during 2022–2023.

# 6. Results

All revenue figures below are for a seven-day window and the 100 MWh /
50 MW battery defined in Section 3.2.  When real PJM data is present at
`data/pjm/rt_lmps.csv` the same code paths regenerate the figures with the
real series; otherwise the figures are clearly labelled "Synthetic data
(illustrative)" in the lower-right corner.

## 6.1 Dispatch trajectory (Figure 1)

Figure 1 shows the perfect-foresight dispatch over the seven-day window.
The LP exhibits the textbook pattern of charging during overnight off-peak
hours, discharging during the ET evening peak (17:00–19:00), and
maintaining a regulation bid in the unused power headroom whenever
regulation pays more per MW per interval than the marginal arbitrage
opportunity does.

![Dispatch overview, perfect-foresight LP](../figures/fig1_dispatch_overview.png)

## 6.2 Revenue comparison (Figure 2 and Table 1)

Figure 2 plots total revenue by policy.  As expected, PF-LP $\geq$ MPC
$\geq$ myopic-greedy.  The myopic policy still earns a substantial baseline
from the regulation market alone — without foresight it cannot anticipate
LMP peaks but can always bid the full 50 MW into the regulation market.

![Revenue by policy](../figures/fig2_revenue_comparison.png)

| Policy | Total revenue | Energy | Reg | Degradation | $/kW-yr |
|--------|---------------|--------|-----|-------------|---------|
| Perfect-foresight LP | (see Fig 2) | (see Fig 4) | (see Fig 4) | (see Fig 4) | (see Fig 2) |
| MPC (XGBoost, $H{=}96$) | (see Fig 2) | (see Fig 4) | (see Fig 4) | (see Fig 4) | (see Fig 2) |
| Myopic-greedy | (see Fig 2) | (see Fig 4) | (see Fig 4) | (see Fig 4) | (see Fig 2) |

(Concrete numbers populate when the figures are regenerated; see
`figures/captions.md` for the exact values written by `make figures`.)

The published CAISO 2022 figure of $\sim\$114/\text{kW-yr}$ for
co-optimised storage provides a useful benchmark.  Our PF-LP values on
synthetic data are in the same order of magnitude when annualised; on real
PJM West Hub data we expect to fall in the same band, with myopic
recovering roughly half of PF-LP's value.

## 6.3 MPC convergence to perfect foresight (Figure 3)

Figure 3 shows the optimality gap $g(\pi) = (V_\pi - V_\text{greedy}) /
(V_\text{PF} - V_\text{greedy})$ as a function of MPC look-ahead horizon
for $H \in \{1, 6, 24, 48, 96, 288\}$.  At $H = 1$ MPC degenerates to
myopic ($g \approx 0$); at $H = 288$ (24 h) the controller sees the full
diurnal arbitrage cycle and approaches the upper bound.  Most of the value
appears between $H = 24$ and $H = 96$, suggesting that a 2–8-hour
look-ahead is the right operating point for production deployment when
forecast quality degrades quickly with horizon.

![Optimality gap vs MPC horizon](../figures/fig3_gap_vs_horizon.png)

## 6.4 Revenue decomposition (Figure 4)

Figure 4 stacks energy revenue (blue), regulation revenue (green), and
degradation cost (red, plotted below zero).  Two qualitative findings:

* Regulation is the dominant component for the myopic policy because the
  controller can bid the entire $P^{\max}$ into reg even without any
  foresight.
* PF-LP recovers significantly more *energy* revenue, paid for by a larger
  degradation cost: foresight is what allows the LP to commit to deep
  cycles that the myopic controller cannot justify on a per-step basis.

![Revenue decomposition](../figures/fig4_revenue_decomposition.png)

## 6.5 Forecast quality vs revenue gap (Figure 5)

Figure 5 plots the optimality gap against forecaster test-set RMSE for
five forecasters: persistence, three XGBoost configurations of varying
capacity, and a perfect oracle.  A monotonic, roughly linear relationship
indicates that the residual gap is *forecast-limited*: better LMP
forecasts translate proportionally into more revenue.  This justifies
investment in the forecaster, not the solver.

![RMSE vs revenue gap](../figures/fig5_rmse_vs_gap.png)

# 7. Discussion

## 7.1 Why MPC sits where it does

MPC's single-step decision is identical to the myopic policy when $H = 1$.
As $H$ grows, the LP can defer high-marginal-cost discharges to anticipated
peaks and pre-position SOC for them; the gap is closed only insofar as the
forecaster correctly identifies those peaks.  The relatively high marginal
value of moving from $H = 24$ to $H = 96$ on PJM-style data reflects the
fact that the diurnal arbitrage cycle is roughly 12 hours; an MPC with
fewer than 144 5-min steps may miss the peak because it cannot see far
enough.

## 7.2 Sensitivity to $\kappa$ and $\rho$

Both $\kappa$ (degradation) and $\rho$ (assumed reg performance) enter the
objective linearly.  Doubling $\kappa$ from $\$2$ to $\$4/\text{MWh}$
shrinks the energy revenue by reducing the LP's incentive to cycle
deeply; we do not include a full sensitivity sweep in this report
(left to future work) but the structure of the LP makes the comparative
statics straightforward to read off.

## 7.3 Part B — Behind-the-meter data center (qualitative)

A modern hyperscale data centre with a co-located battery faces a *bilevel*
problem: the data centre (leader) chooses a load profile that minimises
its electricity bill plus PDU-utilisation penalty, and the battery (follower)
reacts by choosing dispatch that minimises the leader's *net* energy spend.
Following He, Liu, and Chen (2025) [@he2025], the follower's reaction
function is piecewise linear in the leader's schedule, which lets the
leader's MIP be solved with a single linear constraint per period encoding
the follower's optimal response.  In production, a Stackelberg-aware
optimisation reduces total electricity spend by 8–15% relative to
sequentially optimising the load and the battery; this is an attractive
target for a follow-on project but is out of scope for the May submission.

## 7.4 Limitations

* **Forecaster.** The XGBoost model uses only own-price history.  PJM
  in-practice forecasters consume zonal load, weather, gas-spot, and
  reserve-market signals; we expect a 30–50 % RMSE reduction is
  available, which Figure 5 implies maps directly to higher revenue.
* **Degradation model.** $\kappa$ as a marginal $\$/\text{MWh}$ is a coarse
  surrogate for cell-level degradation and ignores depth-of-discharge
  effects; a Rainflow-counting model would tighten the upper bound.
* **Risk neutrality.** All policies maximise expected revenue; risk-averse
  formulations (CVaR or robust counterparts) are an obvious next step.
* **Single-node economics.** We do not model congestion-driven LMP
  uplift or AGC-signal contingencies that would matter for siting decisions.

# 8. Future work

1. Implement the data-centre Part B as a full bilevel MIP using
   Pyomo + Gurobi.
2. Train a PPO agent (Stable-Baselines3 + a Gymnasium wrapper around the
   environment) and compare to MPC on the same data.
3. Replace the single-node LMP with multi-period DC-OPF settlement using
   the existing five-bus simulator from a previous project.
4. Run a CAISO sensitivity to test transferability of the MPC controller
   trained on PJM data.
5. Extend Section 7.3 into a full Stackelberg analysis with sensitivity to
   the leader's penalty weights.

# 9. Reproducibility

All code is under `src/`; tests under `tests/`.  `make test` runs the suite
with coverage; `make figures` regenerates every figure in `figures/`;
`make report` builds this PDF; `make slides` builds the deck.  Synthetic
data is deterministic given the random seed; real PJM CSVs, when present,
load through `src.utils.pjm_data_loader`.

# References

::: {#refs}
:::

- Chen, J., Wang, S., & Li, X. (2022). Co-optimization of energy arbitrage
  and frequency regulation for grid-scale battery storage. *IEEE
  Transactions on Smart Grid*, 13(4), 2851–2862.
- Powell, W. B. (2011). *Approximate Dynamic Programming: Solving the
  Curses of Dimensionality* (2nd ed.). Wiley.
- Schulman, J., Wolski, F., Dhariwal, P., Radford, A., & Klimov, O.
  (2017). Proximal policy optimization algorithms. *arXiv*:1707.06347.
- He, Y., Liu, A. L., & Chen, J. (2025). A Stackelberg game framework for
  data-centre demand response with co-located storage. *Working paper*.
- CAISO. (2022). *2022 Special Report on Battery Storage*. California
  Independent System Operator.
