"""Bridge from the FastAPI layer to the existing SDP code in ``src/policies``.

Adds the project root to ``sys.path`` so we can import ``src.*`` without
restructuring the original package — that code is the research code, this is
the API layer wrapping it.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Make the parent project's `src` package importable
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_PROJECT_ROOT = _BACKEND_DIR.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from src.policies.myopic_greedy import solve_myopic_greedy  # noqa: E402
from src.policies.perfect_foresight_lp import solve_perfect_foresight  # noqa: E402
from src.policies.types import DispatchResult  # noqa: E402
from src.utils.config import BatteryParams  # noqa: E402
from src.utils.synthetic_data import (  # noqa: E402
    generate_synthetic_lmps,
    generate_synthetic_reg_prices,
)

from app.schemas.sdp import BatteryParamsSchema, PolicyName, PolicyResult, SDPResponse


def _battery_from_schema(schema: BatteryParamsSchema) -> BatteryParams:
    return BatteryParams(
        E_max=schema.e_max_mwh,
        P_max=schema.p_max_mw,
        eta_c=schema.eta_c,
        eta_d=schema.eta_d,
        kappa=schema.kappa,
        E_initial=schema.initial_soc_mwh,
        rho_assumed=schema.rho_assumed,
    )


def _generate_prices(
    horizon_hours: int,
    timestep_minutes: int,
    seed: int,
) -> tuple[pd.Series, pd.DataFrame]:
    """Synthetic LMP + reg prices over the horizon."""
    n_intervals = (horizon_hours * 60) // timestep_minutes
    n_days = max(1, (n_intervals * timestep_minutes + 1439) // (24 * 60))
    lmp = generate_synthetic_lmps(n_days=n_days, freq_minutes=timestep_minutes, seed=seed)
    lmp = lmp.iloc[:n_intervals]
    reg = generate_synthetic_reg_prices(lmp, seed=seed)
    return lmp, reg


def _result_to_schema(res: DispatchResult, name: PolicyName) -> PolicyResult:
    s = res.schedule
    return PolicyResult(
        policy_name=name,
        total_revenue=res.total_revenue,
        energy_revenue=res.energy_revenue,
        regulation_revenue=res.regulation_revenue,
        degradation_cost=res.degradation_cost,
        solve_time_seconds=res.solve_time_seconds,
        schedule_charge_mw=s["c_mw"].astype(float).tolist(),
        schedule_discharge_mw=s["d_mw"].astype(float).tolist(),
        schedule_soc_mwh=s["E_mwh"].astype(float).tolist(),
        schedule_lmp=s["lmp"].astype(float).tolist(),
    )


def run_sdp_comparison(
    policies: list[PolicyName],
    battery: BatteryParamsSchema,
    horizon_hours: int,
    timestep_minutes: int,
    mpc_horizon_hours: int,
    forecast: str,
    seed: int,
) -> SDPResponse:
    bp = _battery_from_schema(battery)
    dt_hours = timestep_minutes / 60.0
    lmps, reg = _generate_prices(horizon_hours, timestep_minutes, seed)
    timestamps = [t.isoformat() for t in lmps.index]

    out: list[PolicyResult] = []
    for pol in policies:
        if pol == "perfect_foresight":
            res = solve_perfect_foresight(
                lmps=lmps,
                reg_cap_prices=reg["reg_cap_price"],
                reg_perf_prices=reg["reg_perf_price"],
                battery=bp,
                dt_hours=dt_hours,
                rho_assumed=battery.rho_assumed,
            )
        elif pol == "myopic_greedy":
            res = solve_myopic_greedy(
                lmps=lmps,
                reg_cap_prices=reg["reg_cap_price"],
                reg_perf_prices=reg["reg_perf_price"],
                battery=bp,
                dt_hours=dt_hours,
                rho_assumed=battery.rho_assumed,
            )
        elif pol == "mpc":
            # Use a simple naive-persistence forecaster for the API to stay light.
            from src.policies.mpc import solve_mpc

            class _NaiveForecaster:
                lag = 1

                def predict_horizon(self, history, horizon_steps, freq=pd.Timedelta("5min")):
                    last = float(history.iloc[-1])
                    idx = pd.date_range(
                        start=history.index[-1] + freq, periods=horizon_steps, freq=freq
                    )
                    return pd.Series(np.full(horizon_steps, last), index=idx)

            mpc_horizon_steps = int((mpc_horizon_hours * 60) / timestep_minutes)
            res = solve_mpc(
                lmps=lmps,
                reg_cap_prices=reg["reg_cap_price"],
                reg_perf_prices=reg["reg_perf_price"],
                forecaster=_NaiveForecaster(),
                horizon_steps=mpc_horizon_steps,
                battery=bp,
                dt_hours=dt_hours,
                rho_assumed=battery.rho_assumed,
            )
        else:
            raise ValueError(f"Unknown policy: {pol}")
        out.append(_result_to_schema(res, pol))

    return SDPResponse(timestamps=timestamps, policies=out)
