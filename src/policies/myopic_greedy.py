"""Myopic (one-step) greedy dispatch policy.

At each settlement interval the policy solves the *single-period* LP

    max  lmp_t * (d_t - c_t) * dt
        + reg_cap_t * b_reg_t * dt
        + reg_perf_t * rho * b_reg_t * dt
        - kappa * (c_t + d_t) * dt

    s.t. 0 <= c_t, d_t, b_reg_t
         c_t + d_t + b_reg_t <= P_max
         0 <= E_t + eta_c*c_t*dt - d_t*dt/eta_d <= E_max

The single-step LP is small enough to solve analytically — we evaluate the
four candidate vertices (charge, discharge, reg-only, idle) and pick the
best — which is far cheaper than calling cvxpy 8000+ times.

This policy is the lower bound in the report.
"""

from __future__ import annotations

import time

import numpy as np
import pandas as pd

from src.policies.types import DispatchResult
from src.utils.config import DEFAULT_BATTERY, BatteryParams


def _greedy_step(
    E: float,
    lmp: float,
    reg_cap: float,
    reg_perf: float,
    rho: float,
    bp: BatteryParams,
    dt: float,
) -> tuple[float, float, float]:
    """Return (c, d, b_reg) maximising the *current* interval reward.

    Solves the one-period LP analytically.  The single-period LP is a 3-D LP
    with 4 inequality constraints + non-negativity.  The optimum is at a
    vertex; we enumerate them.
    """
    # Headroom on charging / discharging from SOC bounds (MW that fits in dt)
    c_soc_cap = max((bp.E_max - E) / (bp.eta_c * dt), 0.0)
    d_soc_cap = max(E * bp.eta_d / dt, 0.0)

    c_max = min(bp.P_max, c_soc_cap)
    d_max = min(bp.P_max, d_soc_cap)

    # Coefficients (per MW per dt)
    energy_charge_coef = -lmp * dt - bp.kappa * dt          # value of 1 MW charge
    energy_discharge_coef = lmp * dt - bp.kappa * dt        # value of 1 MW discharge
    reg_coef = (reg_cap + rho * reg_perf) * dt              # value of 1 MW reg bid

    # Candidate 1: idle
    candidates: list[tuple[float, float, float, float]] = [(0.0, 0.0, 0.0, 0.0)]

    # Candidate 2: discharge to the cap, no reg
    if d_max > 0 and energy_discharge_coef > 0:
        candidates.append((0.0, d_max, 0.0, energy_discharge_coef * d_max))

    # Candidate 3: charge to the cap (only if energy_charge_coef + future > 0).
    # In a *myopic* policy charging immediately is never optimal because the
    # current-period reward is energy_charge_coef <= 0 (assuming lmp >= 0).
    # We still consider it for negative LMPs.
    if c_max > 0 and energy_charge_coef > 0:
        candidates.append((c_max, 0.0, 0.0, energy_charge_coef * c_max))

    # Candidate 4: pure reg bid up to P_max (no charge / discharge required)
    if reg_coef > 0:
        b = bp.P_max
        candidates.append((0.0, 0.0, b, reg_coef * b))

    # Candidate 5: discharge + reg (split P_max).  When discharge is profitable
    # and reg is profitable, the optimum is to use whichever has higher coef
    # for any *additional* MW.  Reg vs discharge:
    if d_max > 0 and energy_discharge_coef > 0 and reg_coef > 0:
        # Use d up to min(d_max, P_max), fill the rest with reg
        d_use = min(d_max, bp.P_max)
        b_use = max(bp.P_max - d_use, 0.0)
        if energy_discharge_coef >= reg_coef:
            val = energy_discharge_coef * d_use + reg_coef * b_use
            candidates.append((0.0, d_use, b_use, val))
        else:
            # reg is more valuable per MW; max reg first, then discharge with
            # any leftover (but reg uses the headroom so this collapses to
            # pure reg unless discharge can use SOC headroom independently).
            b_use2 = bp.P_max
            candidates.append((0.0, 0.0, b_use2, reg_coef * b_use2))

    # Candidate 6: charge + reg (only if energy_charge_coef > 0, e.g., negative LMP)
    if c_max > 0 and energy_charge_coef > 0 and reg_coef > 0:
        c_use = min(c_max, bp.P_max)
        b_use = max(bp.P_max - c_use, 0.0)
        val = energy_charge_coef * c_use + reg_coef * b_use
        candidates.append((c_use, 0.0, b_use, val))

    # Pick the best
    best = max(candidates, key=lambda x: x[3])
    return best[0], best[1], best[2]


def solve_myopic_greedy(
    lmps: pd.Series,
    reg_cap_prices: pd.Series,
    reg_perf_prices: pd.Series,
    battery: BatteryParams = DEFAULT_BATTERY,
    dt_hours: float = 5.0 / 60.0,
    rho_assumed: float = 0.95,
    policy_name: str = "myopic_greedy",
) -> DispatchResult:
    """Run the myopic-greedy policy and return a :class:`DispatchResult`."""
    if lmps.index.tz is None:
        raise ValueError("lmps must be tz-aware")
    if not lmps.index.equals(reg_cap_prices.index):
        raise ValueError("lmps and reg_cap_prices must share an index")
    if not lmps.index.equals(reg_perf_prices.index):
        raise ValueError("lmps and reg_perf_prices must share an index")

    lmp_arr = np.asarray(lmps.to_numpy(), dtype=float)
    reg_cap_arr = np.asarray(reg_cap_prices.to_numpy(), dtype=float)
    reg_perf_arr = np.asarray(reg_perf_prices.to_numpy(), dtype=float)
    T = len(lmp_arr)

    c_out = np.zeros(T)
    d_out = np.zeros(T)
    b_out = np.zeros(T)
    E_out = np.zeros(T)

    E = float(battery.E_initial)
    t0 = time.perf_counter()
    for t in range(T):
        c, d, b = _greedy_step(
            E=E,
            lmp=lmp_arr[t],
            reg_cap=reg_cap_arr[t],
            reg_perf=reg_perf_arr[t],
            rho=rho_assumed,
            bp=battery,
            dt=dt_hours,
        )
        # Apply transition (no clipping needed: caps already enforced in step)
        E = E + battery.eta_c * c * dt_hours - d * dt_hours / battery.eta_d
        # Numerical guard
        E = float(np.clip(E, 0.0, battery.E_max))
        c_out[t] = c
        d_out[t] = d
        b_out[t] = b
        E_out[t] = E
    elapsed = time.perf_counter() - t0

    energy_reward = lmp_arr * (d_out - c_out) * dt_hours
    reg_reward = reg_cap_arr * b_out * dt_hours + reg_perf_arr * rho_assumed * b_out * dt_hours
    deg = battery.kappa * (c_out + d_out) * dt_hours
    reward = energy_reward + reg_reward - deg

    schedule = pd.DataFrame(
        {
            "c_mw": c_out,
            "d_mw": d_out,
            "b_reg_mw": b_out,
            "E_mwh": E_out,
            "lmp": lmp_arr,
            "reward": reward,
        },
        index=lmps.index,
    )

    return DispatchResult(
        schedule=schedule,
        total_revenue=float(reward.sum()),
        energy_revenue=float(energy_reward.sum()),
        regulation_revenue=float(reg_reward.sum()),
        degradation_cost=float(deg.sum()),
        solve_time_seconds=elapsed,
        policy_name=policy_name,
    )
