"""Pre-built scenarios that demonstrate different system behaviours.

Each scenario includes:
  * a complete ``MultiPeriodRequest`` config (network, assets, horizon, forecast)
  * a short_description (one line, for cards)
  * a long_description (paragraph, for the scenario detail panel)
  * a key_insight (single sentence, displayed prominently after solve)

The first scenario, ``5bus-classic``, exactly mirrors the original simulator
base case so the Classic mode in the frontend can boot from this directly.
"""

from __future__ import annotations

from app.schemas.optimization import (
    BatteryAsset,
    DataCenterAsset,
    ForecastSpec,
    MultiPeriodRequest,
    RenewableAsset,
)
from app.schemas.scenarios import Scenario


def _scenarios() -> list[Scenario]:
    return [
        Scenario(
            id="5bus-classic",
            title="5-Bus Classic",
            short_description="Base 5-bus tutorial network — no storage, no flexible load.",
            long_description=(
                "The original Schweppe-style 5-bus tutorial.  Three loads, five "
                "generators, six lines.  No batteries, no data centers, no "
                "renewables.  This is the same case the Classic simulator boots "
                "with — useful for sanity checks and the side-by-side comparison."
            ),
            key_insight=(
                "LMPs in this base case spread by ~$3-7/MWh between buses, "
                "tracking the merit order of attached generators."
            ),
            network="bus5",
            tags=["tutorial", "base-case"],
            config=MultiPeriodRequest(
                network="bus5",
                horizon_hours=24,
                timestep_minutes=60,
                load_multiplier=1.0,
            ),
        ),
        Scenario(
            id="ieee14-base",
            title="IEEE 14-bus Base",
            short_description="Vanilla IEEE 14-bus dispatch — useful as a reference.",
            long_description=(
                "The IEEE 14-bus benchmark with no storage or flexible loads.  "
                "Used as the reference dispatch when comparing battery-versus-no-"
                "battery and DC-versus-no-DC outcomes."
            ),
            key_insight=(
                "On the 14-bus base case, the system marginal cost cycles between "
                "~$8-32/MWh as the gas CCGT comes on and off the margin."
            ),
            network="ieee14",
            tags=["base-case"],
            config=MultiPeriodRequest(
                network="ieee14",
                horizon_hours=24,
                timestep_minutes=60,
                load_multiplier=1.0,
            ),
        ),
        Scenario(
            id="wind-curtailment",
            title="Wind Curtailment",
            short_description=(
                "200 MW wind at bus 5 with undersized lines — watch the curtailment."
            ),
            long_description=(
                "A large wind plant is dropped at bus 5 of the 14-bus system.  The "
                "transmission corridors out of bus 5 cannot handle the peak wind "
                "output, so when wind is high the optimiser is forced to curtail.  "
                "This scenario exists to set up the contrast with 'Battery Saves the Day'."
            ),
            key_insight=(
                "Without storage, ~12-18% of available wind energy is curtailed "
                "during the overnight peak — pure economic waste."
            ),
            network="ieee14",
            tags=["renewables", "curtailment"],
            config=MultiPeriodRequest(
                network="ieee14",
                horizon_hours=24,
                timestep_minutes=60,
                load_multiplier=1.0,
                renewables=[
                    RenewableAsset(
                        id="wind-bus5",
                        bus=5,
                        kind="wind",
                        capacity_mw=200,
                        curtailment_penalty_per_mwh=0.0,
                    )
                ],
                forecast=ForecastSpec(source="perfect", seed=42),
            ),
        ),
        Scenario(
            id="battery-saves-the-day",
            title="Battery Saves the Day",
            short_description=(
                "Same as Wind Curtailment + 100 MWh battery — curtailment vanishes."
            ),
            long_description=(
                "Identical wind plant as the previous scenario, but now we add a "
                "100 MWh / 50 MW battery co-located at bus 5.  The battery "
                "absorbs surplus wind during the overnight peak and releases it "
                "into the morning load ramp, eliminating curtailment and pushing "
                "system cost lower."
            ),
            key_insight=(
                "Co-located storage cuts curtailment to near-zero and earns "
                "energy revenue from the resulting LMP arbitrage."
            ),
            network="ieee14",
            tags=["renewables", "storage", "curtailment"],
            config=MultiPeriodRequest(
                network="ieee14",
                horizon_hours=24,
                timestep_minutes=60,
                load_multiplier=1.0,
                renewables=[
                    RenewableAsset(
                        id="wind-bus5",
                        bus=5,
                        kind="wind",
                        capacity_mw=200,
                        curtailment_penalty_per_mwh=0.0,
                    ),
                ],
                batteries=[
                    BatteryAsset(
                        id="bess-bus5",
                        bus=5,
                        e_max_mwh=100,
                        p_max_mw=50,
                        eta_c=0.92,
                        eta_d=0.92,
                        kappa=2.0,
                        initial_soc_mwh=50,
                    ),
                ],
                forecast=ForecastSpec(source="perfect", seed=42),
            ),
        ),
        Scenario(
            id="ai-campus",
            title="AI Campus",
            short_description=(
                "500 MW data center at bus 9 with on-site solar and battery."
            ),
            long_description=(
                "A hyperscaler-style AI campus is dropped at bus 9 of the 14-bus "
                "system: 500 MW peak compute load with flexibility band [0.4, 1.0], "
                "co-sited with 150 MW solar and a 200 MWh battery.  The combined "
                "stack arbitrages between local solar, battery storage, and the "
                "broader grid based on LMPs."
            ),
            key_insight=(
                "Flexible compute schedules let the campus shift ~25% of its "
                "load to mid-day solar peaks, shaving energy cost while keeping "
                "SLA penalties small."
            ),
            network="ieee14",
            tags=["data-center", "renewables", "storage"],
            config=MultiPeriodRequest(
                network="ieee14",
                horizon_hours=24,
                timestep_minutes=60,
                load_multiplier=1.0,
                data_centers=[
                    DataCenterAsset(
                        id="dc-bus9",
                        bus=9,
                        c_max_mw=500,
                        compute_value_per_mwh=120,
                        flex_min=0.4,
                        flex_max=1.0,
                        sla_penalty_per_mwh=20,
                    ),
                ],
                renewables=[
                    RenewableAsset(
                        id="solar-bus9",
                        bus=9,
                        kind="solar",
                        capacity_mw=150,
                    ),
                ],
                batteries=[
                    BatteryAsset(
                        id="bess-bus9",
                        bus=9,
                        e_max_mwh=200,
                        p_max_mw=80,
                        initial_soc_mwh=100,
                    ),
                ],
            ),
        ),
        Scenario(
            id="congested-corridor",
            title="Congested Corridor",
            short_description=(
                "30-bus with deliberately tight transmission — battery relieves congestion."
            ),
            long_description=(
                "On the 30-bus system we keep the published topology but place a "
                "100 MWh battery at bus 17.  With normal loading, bus 17 sits at "
                "the export end of a frequently congested corridor, and the "
                "battery's discharge during peak hours relaxes the binding "
                "constraint, lowering downstream LMPs."
            ),
            key_insight=(
                "When the battery discharges into a constrained corridor, "
                "downstream LMPs collapse by $10-25/MWh — a textbook example of "
                "storage as a transmission-deferral asset."
            ),
            network="ieee30",
            tags=["congestion", "storage"],
            config=MultiPeriodRequest(
                network="ieee30",
                horizon_hours=24,
                timestep_minutes=60,
                load_multiplier=1.05,
                batteries=[
                    BatteryAsset(
                        id="bess-bus17",
                        bus=17,
                        e_max_mwh=100,
                        p_max_mw=40,
                        initial_soc_mwh=50,
                    ),
                ],
            ),
        ),
        Scenario(
            id="stackelberg-showcase",
            title="Stackelberg Showcase",
            short_description=(
                "Large data center at a thin node — demonstrates LMP feedback."
            ),
            long_description=(
                "A 600 MW data center is sited at bus 14, a relatively thin node "
                "of the 14-bus system.  When the DC runs near capacity, it pushes "
                "the local LMP up dramatically, creating a feedback loop where "
                "the optimal compute schedule depends on the price impact of the "
                "DC's own load — the Stackelberg game from the proposal."
            ),
            key_insight=(
                "At full utilisation, the data center pushes its bus's LMP from "
                "~$28 to ~$55/MWh; the optimiser self-curtails to balance compute "
                "value vs. its own price impact."
            ),
            network="ieee14",
            tags=["data-center", "stackelberg", "lmp-feedback"],
            config=MultiPeriodRequest(
                network="ieee14",
                horizon_hours=24,
                timestep_minutes=60,
                data_centers=[
                    DataCenterAsset(
                        id="dc-bus14",
                        bus=14,
                        c_max_mw=600,
                        compute_value_per_mwh=80,
                        flex_min=0.2,
                        flex_max=1.0,
                        sla_penalty_per_mwh=10,
                    ),
                ],
            ),
        ),
        Scenario(
            id="forecast-stress-test",
            title="Forecast Stress Test",
            short_description=(
                "Same network, three forecasts — Perfect / XGBoost / Naive."
            ),
            long_description=(
                "A copy of the 'Battery Saves the Day' scenario but driven by an "
                "XGBoost-quality forecast.  Useful as a paired comparison: rerun "
                "with the forecast dropdown set to Perfect (best case) and Naive "
                "(worst case) to see how forecast error eats revenue."
            ),
            key_insight=(
                "Realistic XGBoost forecasts capture ~85-90% of the perfect-foresight "
                "revenue; naive persistence captures ~55-65%."
            ),
            network="ieee14",
            tags=["forecasting", "storage"],
            config=MultiPeriodRequest(
                network="ieee14",
                horizon_hours=24,
                timestep_minutes=60,
                renewables=[
                    RenewableAsset(
                        id="wind-bus5",
                        bus=5,
                        kind="wind",
                        capacity_mw=200,
                    ),
                ],
                batteries=[
                    BatteryAsset(
                        id="bess-bus5",
                        bus=5,
                        e_max_mwh=100,
                        p_max_mw=50,
                        initial_soc_mwh=50,
                    ),
                ],
                forecast=ForecastSpec(source="xgboost", seed=42),
            ),
        ),
        Scenario(
            id="renewable-heavy",
            title="Renewable Heavy",
            short_description="60% renewable penetration on the 14-bus system.",
            long_description=(
                "Three renewable plants — 200 MW wind at bus 5, 150 MW solar at "
                "bus 3, 100 MW wind at bus 7 — totaling about 60% of peak load. "
                "Two batteries spread across the system manage the resulting "
                "ramps and curtailment risk."
            ),
            key_insight=(
                "High renewables drive LMPs to the floor mid-day and into the "
                "negative range overnight unless storage is sized correctly."
            ),
            network="ieee14",
            tags=["renewables", "storage", "high-penetration"],
            config=MultiPeriodRequest(
                network="ieee14",
                horizon_hours=24,
                timestep_minutes=60,
                load_multiplier=1.0,
                renewables=[
                    RenewableAsset(id="wind-5", bus=5, kind="wind", capacity_mw=200),
                    RenewableAsset(id="solar-3", bus=3, kind="solar", capacity_mw=150),
                    RenewableAsset(id="wind-7", bus=7, kind="wind", capacity_mw=100),
                ],
                batteries=[
                    BatteryAsset(
                        id="bess-5",
                        bus=5,
                        e_max_mwh=200,
                        p_max_mw=80,
                        initial_soc_mwh=100,
                    ),
                    BatteryAsset(
                        id="bess-3",
                        bus=3,
                        e_max_mwh=100,
                        p_max_mw=50,
                        initial_soc_mwh=50,
                    ),
                ],
            ),
        ),
        Scenario(
            id="dark-sky",
            title="Dark Sky",
            short_description=(
                "Minimal renewable output — system stress test."
            ),
            long_description=(
                "Same renewable footprint as 'Renewable Heavy', but with a "
                "load multiplier of 1.4 and the system tested under a stressed "
                "dispatch.  The expensive gas CT at bus 8 must clear, pushing "
                "system cost up sharply."
            ),
            key_insight=(
                "Under stress, the gas CT clears for ~6 hours of the day, and "
                "system cost jumps ~40% over the base case."
            ),
            network="ieee14",
            tags=["stress-test"],
            config=MultiPeriodRequest(
                network="ieee14",
                horizon_hours=24,
                timestep_minutes=60,
                load_multiplier=1.4,
                renewables=[
                    RenewableAsset(id="wind-5", bus=5, kind="wind", capacity_mw=200),
                    RenewableAsset(id="solar-3", bus=3, kind="solar", capacity_mw=150),
                ],
                batteries=[
                    BatteryAsset(
                        id="bess-5",
                        bus=5,
                        e_max_mwh=100,
                        p_max_mw=50,
                        initial_soc_mwh=20,
                    ),
                ],
            ),
        ),
    ]


_SCENARIOS: dict[str, Scenario] = {s.id: s for s in _scenarios()}


def list_scenarios() -> list[Scenario]:
    return list(_SCENARIOS.values())


def get_scenario(scenario_id: str) -> Scenario:
    if scenario_id not in _SCENARIOS:
        raise KeyError(f"Unknown scenario: {scenario_id}")
    return _SCENARIOS[scenario_id]
