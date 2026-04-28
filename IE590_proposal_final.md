# Stochastic Co-Optimization of Grid-Scale Batteries and AI Data Centers

### From Standalone BESS Arbitrage to Compute-Flexible Market Making Inside a Congested Network

**IE 590 — Energy Systems in the Age of AI · Spring 2026**
**Final Project Proposal**
Instructor: Dr. Andrew L. Liu · Student: Ian Kleimans
Purdue University, School of Industrial Engineering

---

## 0. Summary

I want to study how a grid-connected asset at a bus of a transmission network can be scheduled under uncertainty to extract revenue from real-time energy prices and frequency regulation simultaneously. The project is structured in two parts that share one mathematical skeleton.

**Part A (the core).** A standalone battery energy storage system (BESS) participates in PJM's real-time energy market and frequency regulation market. The operator chooses charge, discharge, and regulation capacity every five minutes under uncertainty about next-period LMPs, regulation signals, and system state. This is a textbook stochastic dynamic programming problem that the literature has studied extensively, and the goal here is to build my own end-to-end implementation on real PJM data, compare forecast-driven MPC against perfect-foresight and myopic-greedy benchmarks, and quantify how much forecast quality matters for realized revenue.

**Part B (the extension).** Relax the assumption that the load at the node is fixed. In the emerging AI data center configuration (think Crusoe, Fermi America, or hyperscaler campuses co-located with renewables and storage), the compute load itself is a decision variable: training jobs can be throttled, checkpointed, or geographically shifted. This adds a third decision dimension (compute utilization $u_t$) and a new revenue stream (compute value), which turns the operator from a battery arbitrageur into a broader physical "market maker" absorbing surplus power and releasing flexibility during scarcity. I study how this changes the optimal policy and how much additional value compute flexibility unlocks.

Both parts live inside the same 5-bus DC-OPF simulator I built earlier this semester, extended with a new **Optimization** tab that handles multi-period dispatch with storage (and optionally compute) as decision variables. The integration matters because it lets me study a question that most of the BESS literature skips: how does transmission congestion interact with the market maker's optimal policy, and can the asset meaningfully affect its own LMP?

The deliverables are: (1) a formal SDP formulation that covers both cases, (2) working implementations of perfect-foresight LP, MPC with forecasts, and PPO-based RL policies, (3) a comparison of ARIMA, XGBoost, and Amazon Chronos forecasts inside the SDP, (4) the extended simulator with Optimization tab, and (5) a written analysis of when compute flexibility adds enough value to justify the extra engineering.

---

## 1. Motivation

### 1.1 Why batteries first

Grid-scale battery storage has become the fastest-growing flexible resource in US wholesale markets. In PJM, over 80% of battery revenue now comes from frequency regulation rather than energy arbitrage, because batteries follow the RegD signal (sent every two seconds) with much higher fidelity than thermal generators. In CAISO, co-optimized batteries in 2022 earned an average of $114/kW-year across energy and regulation, with the best-sited assets clearing $165/kW-year. These are large, real numbers, and they reflect what the market pays for fast two-sided flexibility.

The operations problem behind those numbers is inherently stochastic. The operator has to commit charge, discharge, and regulation capacity decisions before knowing the next-period price or the realized regulation signal, which directly depletes or replenishes SOC in ways that constrain future decisions. That coupling through the state of charge is what makes it a dynamic program rather than a sequence of myopic bids. Exact dynamic programming on the continuous state space is intractable, which opens the door to MPC, approximate DP, and reinforcement learning. This is exactly the terrain IE 590 is built to cover, and it's the cleanest physical setting I can think of for the methods we've been learning.

### 1.2 Why the data center extension is worth pursuing

Two things changed recently. First, AI training and inference have become one of the largest and fastest-growing sources of US electricity demand, and power availability has replaced chip supply as the binding constraint on hyperscaler buildout. Second, AI workloads turn out to be more flexible than traditional industrial load: training runs can be paused and checkpointed at low cost, inference queries can be routed across regions to wherever power is cheap, and non-urgent batch compute can be scheduled into hours when the grid has surplus. This flexibility, in principle, lets an AI campus do what a battery does (absorb surplus power, reduce consumption during scarcity) but at much larger MW scale than any individual battery plant.

What's missing from the academic literature is a clean formulation that treats all three controls (charge, discharge, compute throttling) as joint decision variables inside a stochastic dispatch problem. The RL-for-power-systems survey by Chen et al. (IEEE TSG 2022) catalogs dozens of papers on battery FR and on building HVAC control, but almost none that put a controllable compute load and a battery on the same node and optimize them jointly. That gap is the research contribution for Part B.

### 1.3 Why both, rather than one or the other

Three reasons. The first is pedagogical: the battery problem is the right place to learn the method cleanly, because the literature is mature, the data is public, and there are benchmarks to compare against. Going straight to the data center case risks conflating "did I set up the SDP correctly" with "is the compute-flexibility framing novel." Separating them means I can validate the machinery on the battery case and then use the exact same machinery with one extra decision variable for the extension.

The second is practical: if the data-center piece runs long or the compute-value numbers turn out to be too speculative to defend, Part A is a complete, defensible project on its own. It's a real graduate-level application of SDP to a real problem with real data, which is the bar IE 590 is asking for.

The third is narrative: the combined project tells a better story than either half. "I built an SDP-driven co-optimization engine for battery arbitrage and regulation on real PJM data, then extended it to study how AI data center flexibility changes the optimal policy and revenue" is a sentence that lands in both energy-trading and AI-infrastructure contexts. Either half alone is weaker.

---

## 2. Shared Problem Setting

Before splitting into the two cases, let me describe what they have in common.

### 2.1 The physical setup

An asset sits at bus $k$ of a transmission network. The asset always includes a **battery energy storage system** with capacity $E_{\max}$ (MWh), maximum charge/discharge rate $P_{\max}$ (MW), round-trip efficiency $\eta_c \eta_d$, and a degradation cost per MWh throughput. In Part B, the asset also includes a **compute cluster** rated at $C_{\max}$ (MW) of IT load at full utilization, plus **on-site renewables** with stochastic output $G_t$ (MW).

The asset participates in two wholesale markets:

- **Real-time energy market**, settling every five minutes at the local LMP $\pi^{\text{LMP}}_t$. Net discharge to the grid is paid at LMP; net charge from the grid is bought at LMP.
- **Frequency regulation market**, clearing every five minutes for capacity at $\pi^{\text{reg,cap}}_t$, with a per-MW performance payment $\pi^{\text{reg,perf}}_t$ scaled by the asset's performance score $\rho_t$. Following PJM convention, the RegD signal is sent every two seconds; the asset must track it to earn full performance credit, and doing so moves energy into and out of the battery in a zero-mean, non-zero-variance way.

### 2.2 The decision cadence

Every five minutes the operator chooses actions. Those actions are committed before the realization of next-period prices and signals. At the end of the period, the environment reveals the realized LMP, regulation signal, and renewable output; rewards accrue; the state updates; and the next decision is made.

### 2.3 What's uncertain

- $\hat{\pi}^{\text{LMP}}_{t+1}$: next-period real-time LMP at bus $k$. Driven by system supply-demand balance and local congestion.
- $\hat{s}^{\text{reg}}_{t+1}$: the realized RegD signal. Zero-mean over a 15-minute window, but with enough high-frequency energy to meaningfully move SOC.
- $\hat{G}_{t+1}$: next-period renewable generation (Part B only). Low predictability for wind, moderate for solar.
- $\hat{J}_{t+1}$: new compute job arrivals (Part B only). Each job has a value per GPU-hour and an SLA deadline.

### 2.4 Objective

Maximize the expected discounted sum of per-period rewards over a 24-hour rolling horizon:
$$\pi^* \in \arg\max_{\pi} \; \mathbb{E}_{\pi}\left[\sum_{t=0}^{T-1} \gamma^t \, r_t(S_t, \pi(S_t); \hat{W}_{t+1})\right]$$

This is the Bellman structure from class, with the specific state, action, reward, and transition determined by which part of the project we're in.

---

## 3. Part A — Standalone Battery Co-Optimization

### 3.1 State

$$S^A_t = \left(E_t,\; \boldsymbol{\pi}^{\text{LMP}}_{t-k:t},\; \boldsymbol{\pi}^{\text{reg}}_{t-k:t},\; \tau_t\right)$$

where $E_t$ is battery SOC, the two price histories preserve the Markov property under serially correlated prices (state augmentation, as described in Chen et al. §II-A, Remark 1), and $\tau_t$ is a time-of-day / day-of-week feature vector.

### 3.2 Action

$$a^A_t = \left(c_t,\; d_t,\; b^{\text{reg}}_t\right)$$

subject to $0 \leq c_t, d_t \leq P_{\max}$, $c_t \cdot d_t = 0$ (no simultaneous charge and discharge), and $0 \leq b^{\text{reg}}_t \leq P_{\max} - \max(c_t, d_t)$ (regulation capacity comes out of the remaining headroom).

### 3.3 Transition

$$E_{t+1} = \text{clip}\left(E_t + \eta_c c_t \Delta t - \frac{d_t \Delta t}{\eta_d} - \Delta E^{\text{reg}}_t,\; 0,\; E_{\max}\right)$$

where $\Delta E^{\text{reg}}_t$ is the net energy moved by tracking the RegD signal during the interval, which depends on $\hat{s}^{\text{reg}}_{t+1}$ and on the fraction $b^{\text{reg}}_t / P_{\max}$ of the battery's capability that is offered into regulation.

### 3.4 Reward

$$r^A_t = \underbrace{\hat{\pi}^{\text{LMP}}_{t+1} \cdot (d_t - c_t) \cdot \Delta t}_{\text{energy revenue}} + \underbrace{\pi^{\text{reg,cap}}_t b^{\text{reg}}_t \Delta t + \pi^{\text{reg,perf}}_t \rho_t b^{\text{reg}}_t \Delta t}_{\text{regulation revenue}} - \underbrace{\kappa \cdot (c_t + d_t) \Delta t}_{\text{degradation}}$$

### 3.5 What Part A teaches

Three things, each of which is worth understanding before touching the data center extension:

- **The value of foresight.** Sweep forecast quality (perfect, ARIMA, XGBoost, Chronos, myopic) and measure the realized revenue curve. This is the single most-cited question in the BESS literature and I want my own end-to-end answer on PJM data.
- **The energy-vs-regulation split.** In PJM, regulation dominates today. Does my optimal policy reproduce that 80/20 revenue split, and does it change under different battery durations (30 min vs. 4 hr) or price regimes? This is a legitimate sanity check that my formulation matches reality.
- **Method comparison at clean scale.** MPC with forecasts, PPO with a simulator, and perfect-foresight LP all produce comparable policies on the same data. This gives me a controlled setting to understand where each method wins and loses, which is exactly the kind of methodological clarity that makes the data center extension tractable.

---

## 4. Part B — Compute-Flexible Data Center Extension

### 4.1 What changes

The asset at the node is now a battery *plus* a compute cluster *plus* on-site renewables. The operator still makes charge, discharge, and regulation bid decisions every five minutes, but also chooses how hard to run the compute cluster. Running compute generates its own revenue, consumes power, and creates SLA obligations on queued jobs.

### 4.2 State

$$S^B_t = S^A_t \cup \left(Q_t,\; G_t\right)$$

where $Q_t$ is a summary of the compute job queue (total MWh of backlog, weighted by value and remaining time-to-deadline) and $G_t$ is current on-site renewable output. I keep $Q_t$ low-dimensional deliberately, because the full queue is high-dimensional and the first-order decision ("should I run compute now or later") is captured by a scalar summary.

### 4.3 Action

$$a^B_t = a^A_t \cup \{u_t\}, \quad u_t \in [0, 1]$$

$u_t$ is the fraction of compute capacity to run in the interval. Non-adjustable loads (cooling baseline, networking) are treated as fixed and folded into the auxiliary load $L_t$.

### 4.4 Transition

Battery SOC evolves as before. New transitions:

$$Q_{t+1} = \text{shift}(Q_t) - u_t \cdot C_{\max} \cdot \Delta t + \hat{J}_{t+1}$$

where $\text{shift}(\cdot)$ advances queued jobs toward their deadlines and drops expired jobs. $\hat{J}_{t+1}$ is new job arrivals sampled from an empirical distribution.

### 4.5 Reward

$$r^B_t = r^A_t + \underbrace{v_t u_t C_{\max} \Delta t}_{\text{compute revenue}} - \underbrace{\hat{\pi}^{\text{LMP}}_{t+1} \cdot (u_t C_{\max} - G_t) \Delta t}_{\text{net site load cost}} - \underbrace{\lambda \cdot \text{SLA}\_\text{penalty}_t}_{\text{SLA violations}}$$

The structure is intentional: compute generates revenue at rate $v_t$ per MWh of IT load, the campus either buys the power to run it or uses on-site renewables (net position is what shows up in the energy term), and the operator pays a penalty $\lambda$ on any job that misses its SLA deadline.

### 4.6 Research questions specific to Part B

- **Value of compute flexibility.** Run the SDP with $u_t$ pinned at $1$ versus $u_t \in [u_{\min}, 1]$, and measure the revenue difference as a function of battery size, renewable fraction, and forecast quality. This is the direct test of whether compute flexibility is worth the engineering cost to build.
- **Substitution vs. complementarity.** Does adding compute flexibility displace battery cycling (because throttling compute is cheaper than discharging and re-charging) or complement it (because compute soaks up surplus renewables that would otherwise curtail, freeing the battery for arbitrage)? The answer matters for how to size the battery relative to the compute cluster.
- **Congestion interaction.** This is the bus-placement experiment from Part A's RQ3 extended to Part B. When the asset is large enough to move the local LMP (a 500 MW data center at a thinly traded node), does the optimal policy change qualitatively? This is where the "market maker" framing stops being a metaphor.

---

## 5. Why This Needs SDP and Why It's Hard

Three reasons, applied to both parts.

**The stochasticity is structural, not cosmetic.** The RegD signal is zero-mean but high-variance, and its realization during the interval moves SOC in ways the operator can't predict. Even if prices were perfectly known, the regulation piece alone forces the operator to hold SOC headroom and to think about policies rather than one-shot decisions. This is the part that a deterministic LP fundamentally cannot capture.

**The state space is continuous and the action space is multi-dimensional.** Even after coarse discretization (20 SOC bins, 10 queue bins in Part B, 10 price-history bins, 5 time-of-day features), exact backward induction is infeasible. This is the textbook curse of dimensionality and is exactly the setting where Powell's ADP book and the RL-for-power-systems survey agree that function approximation is necessary.

**Operational constraints are hard, not soft.** SOC can't go negative, physical discharge can't exceed $P_{\max}$, and SLA penalties in Part B are step functions. An RL policy has to respect these even out-of-distribution, which is a genuine safety-and-robustness problem that the survey's §IV-A discusses at length.

---

## 6. Solution Approaches

I'll implement four methods and compare them. This gives me a layered benchmarking story.

| Method | What it is | What it gives me |
|---|---|---|
| **Perfect-foresight LP** | Deterministic MILP over 24h with known future prices and signals | Theoretical upper bound on revenue |
| **Myopic-greedy** | Optimize next period only, ignore future | Lower bound; no-foresight baseline |
| **MPC with scenarios** | Sample $N=30$ forecast scenarios every 5 min, solve robust LP, implement first action | Industrial benchmark; directly driven by forecast quality |
| **PPO reinforcement learning (Stable-Baselines3)** | Train neural-net policy on a simulator using SB3's PPO implementation, evaluate on held-out data | Forecast-free policy; stress-tests whether learned policies can match or beat forecast-driven MPC |

For Part A, all four methods are straightforward. For Part B, the LP and MPC extend naturally (add $u_t$ as a variable, add job-queue dynamics as constraints); the PPO extension adds one more action dimension and one more state component, which is manageable.

A fifth method I'll mention but probably skip is **hybrid MPC + value function approximation** (short-horizon MPC with a learned terminal value $\hat{V}_\theta(s_{T})$). Powell Ch. 9 argues this often outperforms both pure MPC and pure RL. Including it would be the natural next step if the project were longer; for IE 590 scope I'll flag it in the discussion as future work unless I finish early.

---

## 7. Data and Evaluation

### 7.1 Data sources

- **LMPs:** PJM Data Miner 2 (5-min RTO-wide real-time LMPs) and CAISO OASIS as a sensitivity case. One full year, with at least one congestion-prone node included for the network experiments.
- **Regulation market:** PJM Ancillary Services archive provides RegD signals at 2s resolution and RMCCP/RMPCP capacity+performance prices at 5-min resolution.
- **Renewables (Part B):** NREL WIND Toolkit and the System Advisor Model for plausible on-site generation profiles.
- **Compute value (Part B):** public spot GPU pricing from my own Compute Tracker dataset, translated into $/MWh of IT load. Treated as a parameter to sweep, not a single point estimate.

### 7.2 Evaluation metrics

- **Revenue per kW-year.** Directly comparable to published BESS and data center numbers.
- **Optimality gap** $(V_{\pi} - V_{\text{greedy}}) / (V_{\text{PF}} - V_{\text{greedy}})$. Fraction of the achievable optimality recovered by each policy.
- **Constraint violation rate.** For RL policies, fraction of episodes with SOC excursions or SLA misses. MPC guarantees feasibility by construction; RL does not.
- **Revenue decomposition.** How much comes from energy vs. regulation vs. (in Part B) compute. Does my optimal policy reproduce the 80/20 regulation/energy split observed in PJM today?
- **LMP impact.** For the congestion experiments, the $\ell_2$ norm of the change in systemwide LMP trajectory induced by the asset's optimal policy.

---

## 8. Integration with the DC-OPF Simulator

This is the piece that makes the analysis visual and lets me run the congestion experiments directly. My current simulator solves a single-period DC-OPF on a 5-bus, 6-generator network with a nice interactive UI. It doesn't handle time, storage, or compute load. The project adds all three.

### 8.1 New **Optimization** tab

A second top-level tab alongside the existing live single-period view.

**Top bar:** horizon selector (6h / 12h / 24h), time-step (5 min / 15 min / 1 hr), solver selector (PF-LP / MPC / RL-trained policy), **Optimize** button.

**Left panel (asset placement):**
- *Add Battery.* Choose bus, set $E_{\max}$, $P_{\max}$, round-trip efficiency, degradation cost. Works for both Part A and Part B.
- *Add Data Center.* Choose bus, set $C_{\max}$, compute value $v$, flexibility range $[u_{\min}, 1]$, SLA penalty. Enables Part B mode.
- *Add On-site Renewables.* Choose bus, upload hourly profile or pick a synthetic CAISO/PJM shape.
- Forecast source dropdown: upload CSV, use built-in synthetic scenarios, or pick from ARIMA/XGBoost/Chronos outputs generated by my pipelines.

**Center panel (network view):**
- Existing 5-bus diagram, with a time slider at the bottom scrubbing through the horizon.
- Each line shows its loading as a percentage of thermal limit, color-coded.
- Battery nodes render with a visible SOC bar that animates as the time slider moves.
- Data center nodes render with a utilization gauge.

**Right panel (results):**
- *Line loadings tab:* per-period min/mean/max loading for each line, flagged when binding.
- *Dispatch schedule:* stacked-area chart of generator output by fuel type over time.
- *SOC + utilization trajectories:* line plots over the horizon.
- *LMP heatmap:* bus × time matrix, colored by price.
- *Revenue breakdown:* total revenue split into energy, regulation capacity, regulation performance, (Part B) compute revenue, minus degradation and SLA penalties.

### 8.2 Implementation notes

The existing `buildModel` function in the simulator already assembles a single-period DC-OPF LP with generator, flow, and angle variables. Extending to multi-period with storage requires:

- Time-indexed versions of all existing variables.
- Storage state variables $E_{t,i}$ at each battery bus $i$, coupled by the SOC recursion as equality constraints.
- Charge/discharge variables $c_{t,i}, d_{t,i}$ with the no-simultaneous-both constraint (either as binary, or by tight enough degradation cost that the LP naturally avoids it).
- Regulation capacity $b^{\text{reg}}_{t,i}$ with the headroom constraint.
- (Part B) compute utilization $u_{t,k}$ entering the nodal balance as a controllable load.
- (Part B) queue dynamics, which are awkward to express as pure LP constraints and will probably force a simple approximation: a minimum-utilization-over-horizon constraint rather than a full queue model.

For a 24-hour horizon at 1-hour steps with a battery and a data center, this is roughly 2500-3500 LP variables. The javascript-lp-solver library can handle that comfortably. For larger problems (5-min resolution over 24h), I'll offload to a Python backend running cvxpy with CLARABEL or HiGHS.

### 8.3 What the tab lets me show

Each of the research questions becomes a scenario you can run visually:

- **Part A, forecast comparison.** Add a battery at bus 3, pick PF-LP, note the revenue. Switch to MPC-ARIMA, re-optimize, see the revenue drop and the dispatch pattern become more conservative. Switch to MPC-Chronos, see it recover some of the gap.
- **Part A, congestion.** Add the same battery first at bus 4 (well-connected), then at bus 5 (more isolated). Compare revenues and SOC trajectories.
- **Part B, compute flexibility value.** Add a battery at bus 3. Optimize. Note revenue. Add a data center alongside it. Re-optimize. See the dispatch shift, the battery cycle less aggressively, and the total revenue go up.
- **Part B, market maker feedback.** Put a large data center at a constrained node, re-optimize, and see the LMP heatmap show the asset's own dispatch pattern smoothing the local prices. This is the single clearest visualization of the market-maker intuition.

---

## 9. Implementation Stack and Repository Layout

This section is written so that a coding agent (Claude Code, Codex, or a human collaborator picking the project up midstream) has enough information to start writing code without re-reading the formulation. Everything below is concrete, opinionated, and intended as the default unless explicitly overridden.

### 9.1 Languages and core libraries

| Layer | Tool | Reason |
|---|---|---|
| Numerical / data | Python 3.11, NumPy, pandas | Standard. All time-series and matrix operations live here. |
| LP / MILP solving | `cvxpy` with HiGHS as the default solver, Gurobi if available via academic license | `cvxpy` lets me write the perfect-foresight LP and the MPC subproblems in nearly mathematical notation. HiGHS is free and fast enough; Gurobi is faster on the harder MILP variants. |
| Forecasting | `statsmodels` for ARIMA, `xgboost` for XGBoost, `chronos-forecasting` (Amazon) for Chronos | Already implemented in earlier coursework; reused directly. |
| RL environments | `gymnasium` (the maintained successor to OpenAI Gym) | Standard interface. SB3 expects this. |
| RL algorithms | **Stable-Baselines3** (PPO, SAC as backup) | Battle-tested implementations of the algorithms in the Chen et al. survey. Saves me from reimplementing PPO and getting one of the 37 standard implementation details wrong. |
| Logging | TensorBoard via SB3's built-in callback | Reward curves, value loss, episode length. Essential for debugging RL training. |
| Frontend (simulator) | Plain JavaScript + D3.js + `javascript-lp-solver` (already built) | Existing 5-bus DC-OPF simulator. Multi-period extension uses a Python backend via a small Flask server. |
| Backend (simulator) | Flask, exposing `/optimize` endpoint that returns dispatch + storage trajectories as JSON | Keeps the heavy LP work in Python, the visualization work in the browser. |

### 9.2 Why Stable-Baselines3 specifically

Three options were considered for the RL piece: rolling my own PPO from scratch, using a research framework like RLlib or CleanRL, or using SB3.

Rolling my own PPO is a pedagogical trap. The original Schulman et al. paper does not specify several implementation details (advantage normalization, value-function clipping, the exact entropy bonus schedule, learning rate annealing, observation normalization), and the gap between "PPO that works" and "PPO that silently underperforms by 30%" is exactly those details. The ICLR paper "The 37 Implementation Details of PPO" exists because every reimplementer hits this. For IE 590, I get no credit for reimplementing PPO; I get credit for applying it correctly.

RLlib and CleanRL are alternatives. RLlib is more powerful but built for distributed training I don't need. CleanRL is excellent for understanding the algorithm but still leaves me wiring everything together.

SB3 is the right choice because it is the standard for applied RL projects of this scale, the API is clean, it integrates directly with `gymnasium`, and most of the recent battery-RL papers in the Chen et al. survey that use PPO use SB3 under the hood. The contribution I'm being graded on is the problem formulation and the analysis, not the optimizer; SB3 lets me keep the line between "infrastructure" and "research" clean.

### 9.3 The Gymnasium environment is where the work lives

The piece of code I actually write — and the piece that captures my domain knowledge — is the environment class. Everything SB3 does is downstream of this.

**`BatteryArbitrageEnv` (Part A) skeleton:**

```python
import gymnasium as gym
import numpy as np

class BatteryArbitrageEnv(gym.Env):
    """
    State: SOC, last-k LMPs, last-k regulation prices, time-of-day features.
    Action: signed power [-1, 1] (negative = charge, positive = discharge),
            regulation capacity bid [0, 1] (fraction of remaining headroom).
    Reward: energy revenue + reg capacity + reg performance - degradation.
    """

    def __init__(self, price_data, reg_signal_data, battery_params,
                 history_length=12, episode_length_steps=288):  # 24h at 5min
        super().__init__()

        self.price_data = price_data            # pandas Series of LMPs at 5-min res
        self.reg_signal_data = reg_signal_data  # pandas Series of RegD signals
        self.params = battery_params             # E_max, P_max, eta_c, eta_d, kappa
        self.history_length = history_length
        self.episode_length = episode_length_steps

        # Observation: [SOC, last_k_lmps, last_k_reg_caps, sin(hour), cos(hour),
        #               sin(dow), cos(dow)]
        n_obs = 1 + 2 * history_length + 4
        self.observation_space = gym.spaces.Box(
            low=-np.inf, high=np.inf, shape=(n_obs,), dtype=np.float32
        )

        # Action: [signed_power, reg_bid_fraction], both in [-1, 1] / [0, 1]
        # Signed power sidesteps the bilinear no-simultaneous-charge-discharge constraint
        self.action_space = gym.spaces.Box(
            low=np.array([-1.0, 0.0]), high=np.array([1.0, 1.0]), dtype=np.float32
        )

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        # Sample a random start index in the historical data
        # Initialize SOC, populate history buffers
        ...
        return self._get_obs(), {}

    def step(self, action):
        signed_power, reg_frac = action
        # Decode signed_power into (charge, discharge)
        if signed_power >= 0:
            d = signed_power * self.params["P_max"]; c = 0.0
        else:
            c = -signed_power * self.params["P_max"]; d = 0.0

        # Regulation bid is fraction of remaining headroom
        headroom = self.params["P_max"] - max(c, d)
        b_reg = reg_frac * headroom

        # Sample regulation signal realization for this interval
        reg_signal_realized = self._sample_reg_signal()
        delta_E_reg = b_reg * reg_signal_realized * (5 / 60)  # MWh moved

        # Update SOC (clip to [0, E_max])
        self.E = np.clip(
            self.E + self.params["eta_c"] * c * (5/60)
                  - d * (5/60) / self.params["eta_d"]
                  - delta_E_reg,
            0, self.params["E_max"]
        )

        # Reward
        lmp_next = self.price_data.iloc[self.t + 1]
        reg_cap_price = self.reg_cap_data.iloc[self.t]
        reg_perf_price = self.reg_perf_data.iloc[self.t]
        rho = self._performance_score(b_reg, reg_signal_realized)

        energy_revenue = lmp_next * (d - c) * (5/60)
        reg_revenue = (reg_cap_price + reg_perf_price * rho) * b_reg * (5/60)
        degradation = self.params["kappa"] * (c + d) * (5/60)

        reward = energy_revenue + reg_revenue - degradation

        # Reward scaling for PPO stability — keep per-step rewards in roughly [-10, 10]
        reward_scaled = reward / 100.0

        self.t += 1
        terminated = False
        truncated = self.t >= self.start_t + self.episode_length

        info = {
            "energy_revenue": energy_revenue,
            "reg_revenue": reg_revenue,
            "degradation": degradation,
            "soc": self.E,
        }

        return self._get_obs(), reward_scaled, terminated, truncated, info

    def _get_obs(self):
        # Concatenate normalized SOC, price histories, time features
        ...

    def _sample_reg_signal(self):
        # Average the 2-second RegD signal over the 5-minute interval
        ...

    def _performance_score(self, b_reg, signal):
        # Simplified score: 1.0 if perfect tracking, lower if SOC binds
        ...
```

**`DataCenterCampusEnv` (Part B)** extends the above with:

- One additional action dimension: `u` ∈ [0, 1] for compute utilization.
- Two additional observation features: job-queue summary `Q_t` and renewable output `G_t`.
- An additional reward term for compute revenue and SLA penalties.
- Modified energy term: net site load is `(u * C_max + L_aux - G_t)` instead of zero.

### 9.4 SB3 training script (illustrative)

```python
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv, VecNormalize
from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback

def make_env(price_data, reg_data, params, seed):
    def _init():
        env = BatteryArbitrageEnv(price_data, reg_data, params)
        env.reset(seed=seed)
        return env
    return _init

# Training: 8 parallel envs on different historical windows
train_envs = SubprocVecEnv([
    make_env(pjm_train_data[i], regd_train_data[i], BATTERY_PARAMS, seed=i)
    for i in range(8)
])
train_envs = VecNormalize(train_envs, norm_obs=True, norm_reward=False)

eval_env = SubprocVecEnv([make_env(pjm_test_data, regd_test_data, BATTERY_PARAMS, seed=42)])
eval_env = VecNormalize(eval_env, norm_obs=True, norm_reward=False, training=False)

model = PPO(
    "MlpPolicy",
    train_envs,
    learning_rate=3e-4,
    n_steps=2048,
    batch_size=64,
    n_epochs=10,
    gamma=0.99,
    gae_lambda=0.95,
    clip_range=0.2,
    ent_coef=0.01,
    verbose=1,
    tensorboard_log="./logs/ppo_battery/",
    policy_kwargs=dict(net_arch=[256, 256]),
)

eval_callback = EvalCallback(
    eval_env,
    best_model_save_path="./checkpoints/best/",
    log_path="./logs/eval/",
    eval_freq=10_000,
    deterministic=True,
)

model.learn(total_timesteps=2_000_000, callback=eval_callback)
model.save("./checkpoints/ppo_battery_final.zip")
```

### 9.5 Repository layout

```
ie590-project/
├── README.md
├── pyproject.toml                   # poetry / uv project file
├── data/
│   ├── pjm/                         # raw PJM Data Miner exports
│   ├── caiso/                       # raw CAISO OASIS exports
│   ├── nrel_wind/                   # WIND Toolkit profiles
│   └── processed/                   # cleaned, resampled, joined datasets
├── src/
│   ├── forecasting/
│   │   ├── arima.py
│   │   ├── xgboost_model.py
│   │   └── chronos_wrapper.py
│   ├── envs/
│   │   ├── battery_env.py           # BatteryArbitrageEnv (Part A)
│   │   ├── datacenter_env.py        # DataCenterCampusEnv (Part B)
│   │   └── reg_signal_sampler.py
│   ├── policies/
│   │   ├── perfect_foresight_lp.py  # cvxpy formulation, full-horizon
│   │   ├── myopic_greedy.py
│   │   ├── mpc.py                   # scenario-based MPC
│   │   └── ppo_policy.py            # wraps SB3 model for evaluation
│   ├── network/
│   │   ├── dc_opf.py                # Python port of the JS DC-OPF solver
│   │   ├── multiperiod_dc_opf.py    # time-indexed version with storage
│   │   └── network_data.py          # 5-bus topology
│   ├── eval/
│   │   ├── metrics.py               # revenue, optimality gap, violations
│   │   ├── benchmark.py             # runs all policies on same test data
│   │   └── plots.py
│   └── train_ppo.py                 # SB3 training entry point
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_forecasting_comparison.ipynb
│   ├── 03_mpc_results.ipynb
│   ├── 04_ppo_training_diagnostics.ipynb
│   └── 05_network_congestion_experiments.ipynb
├── simulator/                       # extends existing single-period simulator
│   ├── index.html                   # existing live single-period view
│   ├── optimize.html                # NEW: multi-period Optimization tab
│   ├── js/
│   │   ├── ui.js
│   │   ├── network_render.js
│   │   └── api_client.js            # talks to Flask backend
│   └── server/
│       ├── app.py                   # Flask server exposing /optimize endpoint
│       └── solve.py                 # wraps multiperiod_dc_opf.py
├── checkpoints/                     # SB3 model checkpoints (gitignored)
├── logs/                            # TensorBoard logs (gitignored)
└── tests/
    ├── test_battery_env.py
    ├── test_dc_opf.py
    └── test_mpc_consistency.py      # MPC with perfect forecast → PF-LP value
```

### 9.6 Implementation gotchas worth flagging up front

A coding agent picking this up should know about these before writing any code:

**Action space design.** SB3's PPO works best with continuous Box action spaces. The simultaneous-charge-discharge constraint is awkward to express directly; the standard trick (used in the skeleton above) is a single signed action $a \in [-1, 1]$ where positive = discharge, negative = charge. This sidesteps the bilinear $c \cdot d = 0$ constraint without loss of generality.

**Reward scaling.** PPO is sensitive to reward magnitudes. Per-step revenue in raw dollars is in the hundreds of thousands and will destabilize training. Scale by a factor of ~100 (or use `VecNormalize(norm_reward=True)`, but be careful about evaluation interpretation). Final revenue numbers reported in the paper should be unscaled.

**Observation normalization.** Use `VecNormalize(norm_obs=True)` and save the running statistics. When evaluating on test data, load the saved stats and set `training=False`. Forgetting this is the single most common SB3 deployment bug.

**Episode definition.** Each episode should be one full day (288 5-minute steps) sampled from a random week of historical data. This forces the policy to handle peak/off-peak transitions and weekend/weekday differences.

**Regulation signal modeling.** The 2-second RegD signal is too high-frequency for the SDP. Aggregate it to 5-minute interval statistics: mean (≈0), variance, and net energy delta. The policy reacts at 5-minute granularity but the simulator should still sample the 2-second variance to correctly account for SOC churn.

**MPC consistency check.** A useful unit test: MPC with $N = 1$ scenario equal to the realized future trajectory should produce the same revenue as the perfect-foresight LP, to within solver tolerance. If it doesn't, there's a bug in the MPC formulation.

**LP variable count.** A 24-hour horizon at 5-minute resolution with one battery is roughly $288 \times 4 = 1152$ continuous variables plus the network constraints. With one data center it's $\sim 1500$. cvxpy + HiGHS handles this in well under a second. At 1-minute resolution it's $\sim 7200$ variables and starts to slow down; stick to 5-minute unless there's a specific reason.

**Network LP for the Optimization tab.** The existing JavaScript DC-OPF formulation uses positive/negative decomposition for flow variables. The Python port should follow the same convention so that the LMPs match between the two implementations and the live single-period view stays consistent with the multi-period optimization view.

### 9.7 What done looks like

A successful run of the full pipeline produces:

1. A `data/processed/` folder with 12 months of 5-minute PJM LMPs, RegD signals, and capacity prices for the chosen test node, plus matching CAISO data for sensitivity.
2. Three trained forecasting models with held-out RMSE/MAPE on a clean test split.
3. Trained PPO models for both Part A and Part B environments, with TensorBoard logs showing stable convergence.
4. A `eval/benchmark.py` run that produces a CSV with one row per (policy, test-week, asset-config) combination and columns for revenue, optimality gap, and constraint-violation rate.
5. A working Optimization tab in the simulator where I can place a battery (and optionally a data center) at any bus, hit Optimize, and see the dispatch trajectory render.
6. Five Jupyter notebooks (one per stage) that I can re-execute end-to-end and that produce the figures for the final report.

---

## 10. Connections to Course Material and Reading

### 10.1 Mapping to the IE 590 syllabus

The project draws directly on topics from multiple weeks of the course, which is part of why I picked it.

| Syllabus topic | Where it shows up in this project |
|---|---|
| Weeks 3–5: Linear and nonlinear programming for energy operations | The DC-OPF in the simulator and the perfect-foresight LP for Part A are direct applications. |
| Weeks 3–5: Stochastic optimization for power planning under uncertainty | The whole reason this is an SDP rather than a deterministic LP. The MPC formulation uses scenario-based stochastic programming. |
| Weeks 3–5: Risk-aware optimization | The CVaR or robust aggregation across forecast scenarios in MPC (Section 6) is exactly this. |
| Weeks 3–5: Multiagent reinforcement learning | Out of scope for this submission, but flagged as a natural extension when multiple campuses or batteries compete at the same node. |
| Weeks 6–7: AI-based forecasting for wind and solar | The ARIMA / XGBoost / Chronos pipelines feed directly into the MPC and into the renewable-output simulator. |
| Weeks 6–7: Reinforcement learning for renewable dispatch | Part B's compute-flexibility decision (run training when renewables overproduce, throttle when scarce) is a renewable-dispatch problem in disguise. |
| Weeks 8–10: Distributed energy resources and demand response | The data center as a flexible load is a large industrial DR case. |
| Weeks 8–10: RL applications for grid stability and congestion management | RQ3 (the asset's effect on local LMP under transmission congestion) sits squarely here. |
| Weeks 11–12: AI-enhanced bidding strategies and algorithmic trading | The market-maker framing and the regulation-bid optimization are exactly this. |
| Weeks 11–12: Locational marginal pricing | The DC-OPF computes LMPs at every bus; the project studies how a flexible asset interacts with them. |

### 10.2 Reading materials

- **Chen et al., "Reinforcement Learning for Power Systems" (IEEE TSG 2022):** primary literature anchor. The frequency regulation formulation in §III-A and the battery arbitrage models in §III-C map directly onto Parts A and B. The safety, scalability, and data discussions in §IV shape which methods are feasible.
- **Powell, *Approximate Dynamic Programming*:** methodological backbone. Chs. 4–6 on value function approximation; Ch. 9 on hybrid MPC+VFA policies; the post-decision state formulation throughout. Worth noting that Dr. Liu's own work has applied ADP to residential energy management with dynamic pricing, which is a closely related decision-theoretic structure.
- **Schulman et al., "PPO":** the RL algorithm for the SB3-based extension. Robust to hyperparameter choices and the de facto standard in this area.
- **Ng *CS229 notes*, Hastie et al. *ISL*, Zhang et al. *Dive into Deep Learning*, Prince *Understanding Deep Learning*:** foundations for the forecasting and policy-network components.
- **Kingma and Ba, "Adam":** optimizer for both forecasting and PPO.
- **Attention, DeepSeek-R1, Megatron-LM:** contextual references for Part B. These ground the claim that AI training is energy-intensive, that training is partially interruptible (checkpointing), and that inference can be routed geographically. I don't use them as methods, but they motivate the numeric assumptions on $C_{\max}$ and $v_t$.

### 10.3 Stackelberg framing as a future analytical extension

The "market maker affecting its own LMP" piece (RQ3 in Part A, magnified in Part B) has a natural Stackelberg game structure: the asset operator is the leader, committing to a dispatch policy; the market clearing (DC-OPF) is the follower, producing prices that respond to the leader's actions. In a single-period setting this can be cast as a bilevel program. In a dynamic, uncertain setting it becomes a Stackelberg Markov game, which is exactly the structure Dr. Liu and collaborators study in their recent work on learning Stackelberg equilibria with adaptive followers (He, Liu, Chen 2025).

I am not proposing to solve a full Stackelberg equilibrium for this final project. The empirical RQ3 experiments (running the same SDP at different buses and comparing LMP impact) are the achievable scope for May. But formulating the problem with the Stackelberg lens in the final report shows how this work could extend, and is a natural starting point for a longer research direction beyond IE 590.

---

## 11. Scope, Out-of-Scope, and Risks

### In scope (for the May submission)

- Part A formulation, fully written out in the report.
- Part A implementation: perfect-foresight LP, myopic-greedy, MPC with at least one forecasting method, on real PJM data for a representative test month.
- Forecast-quality comparison and revenue-decomposition figures.
- Part B formulation, with conceptual analysis of how compute flexibility would change the optimal policy.
- Discussion of network/congestion effects, drawing on the existing 5-bus DC-OPF simulator.

### In scope (for the longer-term project beyond May)

- Part B implementation with full SDP solution.
- PPO training via Stable-Baselines3 for both parts.
- Multi-period Optimization tab in the simulator with batteries, data center loads, and on-site renewables as placeable assets.
- CAISO sensitivity analysis.
- Stackelberg-equilibrium analysis of the RQ3 case.

### Out of scope entirely

- Capacity expansion and site selection.
- Day-ahead market participation.
- Multi-agent RL across campuses competing at the same node.
- AC power flow and reactive-power dynamics.
- Cyber security and adversarial robustness.

### Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| PJM data pull or data cleaning eats more time than expected | Medium | Pre-cleaned PJM datasets exist on Kaggle and from academic papers; use one of those as the primary, treat fresh Data Miner pulls as bonus |
| MPC implementation has subtle bugs that affect revenue numbers | Medium | The PF-LP-with-perfect-forecast vs. MPC-with-perfect-forecast unit test catches most of these |
| Compute-value parameterization for Part B is too speculative to defend | Low (since Part B is now formulation-only) | Treat as an open parameter in the report, sweep a sensible range qualitatively |
| Slides take longer than expected | Medium | Write report and slides in parallel from May 5; pull figures directly from the analysis notebooks |
| Other coursework or Lilly Fellowship logistics consume the timeline | High | Part A is sized to be the hard floor; if it slips, the report leans more on formulation depth and less on empirical results |

---

## 12. Deliverables and Timeline

### 12.1 Deliverables (per the IE 590 syllabus)

The course rubric specifies two deliverables for the final project:

- **Written report**, 5–10 pages including figures and references. Sections per the syllabus: problem motivation, methodology, results, discussion of assumptions and limitations.
- **Oral presentation**, 10 minutes in class. Must clearly state the problem and its energy-systems relevance, describe the methodology at a conceptual and technical level, highlight key insights and results, and discuss limitations.

Both are due during the final week of the semester (early May 2026), which leaves roughly 1.5 calendar weeks from the date of this proposal.

### 12.2 Realistic timeline given the deadline

The original six-week timeline I sketched in earlier drafts of this document is incompatible with the actual schedule. Compressing to what is genuinely achievable alongside IE 484, IE 486, OBHR 33000, and finals:

| Window | Deliverable |
|---|---|
| **Apr 28 – Apr 30 (this week)** | Proposal sent to Dr. Liu. PJM Data Miner pull for one representative month at a chosen bus. Perfect-foresight LP for Part A formulated and solved end-to-end. Myopic-greedy baseline running. First revenue numbers. |
| **May 1 – May 4** | MPC with one forecasting method (likely XGBoost, since I already have it working). Forecast-quality comparison against perfect foresight and myopic-greedy. Figures generated. |
| **May 5 – May 7** | Written report drafted (5-10 pages). Slides built. |
| **May 8 (or final-week class)** | Oral presentation, report submission. |

### 12.3 Honest scope adjustment

What this means for the project as proposed:

- **Part A is the deliverable.** Perfect-foresight LP, myopic-greedy, and MPC (with at least one forecast method) on real PJM data. Revenue comparison and the optimality-gap analysis as the central result.
- **Part B becomes a formulation-and-discussion section, not an implementation.** I'll write the full SDP formulation in the report (the work is already done in this proposal), discuss what it would take to implement, and qualitatively analyze how compute flexibility would change the optimal policy. This still demonstrates depth of thinking on the most current piece of the energy-AI conversation, but I am not claiming to have built and validated the data center version in 1.5 weeks.
- **PPO via Stable-Baselines3 is future work.** Mentioned in the methodology section as the natural RL extension and as the right tool for the larger problem, but not a deliverable for the May submission. MPC is the methodological centerpiece of what I actually run.
- **The DC-OPF simulator integration becomes a demonstration in the slides rather than a finished feature.** I show the existing single-period live view, walk through how multi-period dispatch with storage would extend it, and put screenshots/mockups of the proposed Optimization tab in the report. The actual implementation of the multi-period tab is post-semester work.

This scope is honest and defensible. A full Part A study with three solution methods on real PJM data is itself a real project — comparable to what's published in the Chen et al. survey's Table III, just with my own data and analysis.

### 12.4 What I keep building after the semester

The full implementation stack in Section 9 (SB3-based PPO, the multi-period Optimization tab, Part B with co-located compute and renewables) remains the longer-term plan. I plan to continue this project through the summer at the Lilly/Purdue AI Acceleration Fellowship if the offer comes through, or alongside whatever role I take. The reason I kept Section 9 in this proposal at full detail is that it's the design spec for that ongoing work — not the May deliverable.

---

## 13. Why I want to do this

Three reasons.

First, the topic sits squarely inside what IE 590 covers and what Dr. Liu's research engages with. The course syllabus runs from stochastic optimization for power planning under uncertainty (weeks 3–5), through reinforcement learning for renewable dispatch (weeks 6–7), to LMP and algorithmic trading in energy markets (weeks 11–12). Dr. Liu's own work spans energy market modeling, decentralized algorithms in smart grid, approximate dynamic programming for residential energy management, and most recently Stackelberg game formulations for dynamic markets. The market-maker framing in this proposal — where a battery or campus dispatch decision moves the local LMP and the market-clearing follower responds — has a natural Stackelberg structure that aligns with that line of work, and is something I'd hope to develop more rigorously beyond the IE 590 deliverable.

Second, the data center extension is directly relevant to the Purdue Grid of Tomorrow Consortium that Dr. Liu co-leads. The consortium's industry partners (Amazon, NVIDIA, Tesla, MISO) are the firms that are actively negotiating the AI-load-and-grid problem in the real world. Treating an AI campus as a flexible market participant rather than a rigid load is one of the open questions in that conversation, and a clean SDP formulation of it is the kind of contribution that could plausibly extend into a longer research direction.

Third, the project is the one place where every tool I've learned this year composes into one thing: DC-OPF from this course, stochastic dynamic programming from the lecture core, time-series forecasting from earlier coursework, and the interactive simulator I already built. Even at the compressed scope, getting Part A done well teaches me more than three separate smaller projects would.

If there's feedback on scope, framing, or whether the compressed Part-A-only version still meets the bar for the final, I'd rather hear it now than at the end.
