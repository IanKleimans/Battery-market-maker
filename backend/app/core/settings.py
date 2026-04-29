"""Runtime configuration loaded from environment variables."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend settings.

    Values are loaded from the environment with sensible defaults for local dev.
    On Railway, override via the dashboard.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_title: str = "Battery Market Maker API"
    api_version: str = "2.0.0"
    api_prefix: str = "/api/v1"

    # CORS — comma-separated list, parsed into a list below.
    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        alias="CORS_ORIGINS",
    )

    # Solver timeouts and limits
    solver_timeout_seconds: float = 60.0
    max_horizon_hours: int = 168
    max_buses: int = 30

    # Long-solve threshold (seconds) — solves expected to take longer stream
    # heartbeats over the WebSocket; faster ones return inline.
    long_solve_threshold_seconds: float = 5.0

    # Optional: real PJM data path (auto-detected if present).
    pjm_data_dir: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]


settings = Settings()
