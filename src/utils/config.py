"""Battery parameters and other run-level configuration.

Implements the ``BatteryParams`` container used across all policies.  Notation
matches the report:

* ``E_max``      — energy capacity (MWh)
* ``P_max``      — instantaneous charge / discharge power limit (MW)
* ``eta_c``      — charge efficiency (0, 1]
* ``eta_d``      — discharge efficiency (0, 1]
* ``kappa``      — marginal degradation cost (USD per MWh of throughput)
* ``E_initial``  — starting state of charge (MWh)
* ``rho_assumed``— assumed regulation performance score (~ 0.95 in PJM)
"""

from __future__ import annotations

from dataclasses import dataclass, field


class InvalidBatteryParams(ValueError):
    """Raised when ``BatteryParams`` are mathematically inconsistent."""


@dataclass(frozen=True)
class BatteryParams:
    """Static physical and economic parameters of a grid-scale battery."""

    E_max: float = 100.0          # MWh
    P_max: float = 50.0           # MW
    eta_c: float = 0.92           # charge efficiency
    eta_d: float = 0.92           # discharge efficiency
    kappa: float = 2.0            # USD / MWh throughput
    E_initial: float = 50.0       # MWh
    rho_assumed: float = 0.95     # assumed regulation performance score

    def __post_init__(self) -> None:
        if self.E_max <= 0:
            raise InvalidBatteryParams(f"E_max must be positive, got {self.E_max}")
        if self.P_max <= 0:
            raise InvalidBatteryParams(f"P_max must be positive, got {self.P_max}")
        if not (0.0 < self.eta_c <= 1.0):
            raise InvalidBatteryParams(f"eta_c must be in (0, 1], got {self.eta_c}")
        if not (0.0 < self.eta_d <= 1.0):
            raise InvalidBatteryParams(f"eta_d must be in (0, 1], got {self.eta_d}")
        if self.kappa < 0:
            raise InvalidBatteryParams(f"kappa must be non-negative, got {self.kappa}")
        if not (0.0 <= self.E_initial <= self.E_max):
            raise InvalidBatteryParams(
                f"E_initial must be within [0, E_max]={self.E_max}, got {self.E_initial}"
            )
        if not (0.0 <= self.rho_assumed <= 1.0):
            raise InvalidBatteryParams(
                f"rho_assumed must be in [0, 1], got {self.rho_assumed}"
            )

    @property
    def round_trip_efficiency(self) -> float:
        """Round-trip efficiency = eta_c * eta_d."""
        return self.eta_c * self.eta_d


DEFAULT_BATTERY: BatteryParams = BatteryParams()
"""Default 100 MWh / 50 MW battery used in the report."""


@dataclass(frozen=True)
class RunConfig:
    """Run-level configuration shared across notebooks and CLI scripts."""

    dt_hours: float = 5.0 / 60.0  # 5-minute settlement interval
    timezone_display: str = "America/New_York"
    seed: int = 42
    figure_dpi: int = 300
    figure_dir: str = "figures"

    def __post_init__(self) -> None:
        if self.dt_hours <= 0:
            raise InvalidBatteryParams(f"dt_hours must be positive, got {self.dt_hours}")


DEFAULT_RUN: RunConfig = RunConfig()
