"""Shared types used by every dispatch policy.

A policy returns a :class:`DispatchResult` that records both the realised
schedule (one row per settlement interval) and aggregate revenue / cost
quantities used by the benchmark and figures.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


REQUIRED_SCHEDULE_COLUMNS: tuple[str, ...] = (
    "c_mw",        # charge MW
    "d_mw",        # discharge MW
    "b_reg_mw",    # regulation capacity bid MW
    "E_mwh",       # state of charge at *end* of interval (MWh)
    "lmp",         # realised LMP ($/MWh)
    "reward",      # interval cash flow ($)
)


@dataclass
class DispatchResult:
    """Output of every dispatch policy.

    Attributes
    ----------
    schedule
        Tz-aware DataFrame indexed by interval start.  Required columns are
        listed in :data:`REQUIRED_SCHEDULE_COLUMNS`.
    total_revenue
        Sum of interval rewards ($).
    energy_revenue
        Revenue from net injection: ``sum(lmp * (d - c) * dt)`` ($).
    regulation_revenue
        Revenue from capacity + performance regulation payments ($).
    degradation_cost
        Total degradation penalty: ``kappa * sum((c + d) * dt)`` ($).
    solve_time_seconds
        Wall-clock time spent inside the policy solver(s).
    policy_name
        Short identifier used by the benchmark and figure code.
    """

    schedule: pd.DataFrame
    total_revenue: float
    energy_revenue: float
    regulation_revenue: float
    degradation_cost: float
    solve_time_seconds: float
    policy_name: str

    def __post_init__(self) -> None:
        missing = [c for c in REQUIRED_SCHEDULE_COLUMNS if c not in self.schedule.columns]
        if missing:
            raise ValueError(
                f"DispatchResult.schedule missing columns {missing}; "
                f"got {list(self.schedule.columns)}"
            )
        if self.schedule.index.tz is None:
            raise ValueError("DispatchResult.schedule.index must be tz-aware")
