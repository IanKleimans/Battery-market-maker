"""FastAPI application entrypoint.

Run locally::

    uv run uvicorn app.main:app --reload --port 8000

The OpenAPI docs are at ``/docs`` and ``/redoc``.  CORS origins are configured
via the ``CORS_ORIGINS`` environment variable (comma-separated).
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.core.settings import settings
from app.routers import (
    forecasting,
    network,
    optimization,
    scenarios,
    sdp,
    stackelberg,
)
from app.ws import solve_progress

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


_TAGS_METADATA = [
    {
        "name": "networks",
        "description": "Standard test-system topologies (5-bus, IEEE 14-bus, IEEE 30-bus).",
    },
    {
        "name": "optimization",
        "description": (
            "DC-OPF solvers.  Use `/optimization/multiperiod` for the asset-aware "
            "scheduler with batteries / data centers / renewables; use "
            "`/optimization/singleperiod` for the lightweight Live-mode dispatch."
        ),
    },
    {
        "name": "sdp",
        "description": (
            "Single-asset stochastic dynamic programming policies (Perfect "
            "Foresight, Myopic Greedy, MPC) — wraps the research code under `src/policies/`."
        ),
    },
    {"name": "forecasting", "description": "Forecast-quality endpoints."},
    {"name": "scenarios", "description": "Pre-built scenario library."},
    {"name": "ws", "description": "WebSocket progress streamer for long solves."},
    {"name": "meta", "description": "Health and metadata endpoints."},
]

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    openapi_tags=_TAGS_METADATA,
    description=(
        "Backend for the **Battery Market Maker** simulator.  Exposes "
        "multi-period DC-OPF, single-asset SDP comparisons, IEEE network "
        "topologies, and pre-built scenarios that demonstrate battery / data "
        "center / renewable interactions on standard test systems."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(network.router, prefix=settings.api_prefix)
app.include_router(optimization.router, prefix=settings.api_prefix)
app.include_router(stackelberg.router, prefix=settings.api_prefix)
app.include_router(sdp.router, prefix=settings.api_prefix)
app.include_router(forecasting.router, prefix=settings.api_prefix)
app.include_router(scenarios.router, prefix=settings.api_prefix)
app.include_router(solve_progress.router, prefix=settings.api_prefix)


@app.get("/", tags=["meta"], summary="Service metadata")
def root() -> dict[str, str]:
    return {
        "service": settings.api_title,
        "version": __version__,
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.get("/health", tags=["meta"], summary="Health check (used by Railway)")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(f"{settings.api_prefix}/health", tags=["meta"])
def api_health() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_error(_: object, exc: Exception) -> JSONResponse:
    logging.exception("Unhandled error")
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "detail": str(exc)},
    )
