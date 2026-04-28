# Figure captions

**Figure 1 — Dispatch overview.** A representative week of perfect-foresight LP dispatch.
Top: LMP (left axis, blue) and battery state of charge (right axis, red). Middle:
charge (negative, orange) and discharge (positive, green) power in MW. Bottom: regulation
capacity bid in MW. SOC respects the 0–100 MWh window; charge/discharge respects the 50 MW
power cap. Note the morning-charge / evening-discharge cycle.

**Figure 2 — Revenue by policy.** Total revenue ($) over the evaluation horizon for each
policy. Perfect-foresight LP is the upper bound; myopic-greedy is the lower bound; MPC
sits in between. Bars are annotated with the realised dollar value.

**Figure 3 — MPC convergence to perfect foresight.** Optimality gap as a function of MPC
look-ahead horizon (5-min intervals, log scale). The dashed lines mark 0 (myopic baseline)
and 1 (perfect foresight). MPC closes most of the gap by ~24 steps (2 h) and approaches
the bound at 288 steps (24 h).

**Figure 4 — Revenue decomposition.** Stacked components of net revenue: energy arbitrage
(blue), regulation services (green), and degradation cost (red, plotted below zero).
Regulation is the dominant contributor for myopic; PF-LP captures more energy arbitrage.

**Figure 5 — Forecast quality vs achieved revenue gap.** Each marker is one
forecaster: Persistence, three XGBoost configurations, and a Perfect oracle.
The dashed red line is a least-squares fit of optimality gap on test-set RMSE.
A monotonic relationship indicates that revenue is forecast-limited rather
than solver-limited.
