"""WebSocket endpoint that streams solve progress.

Client → server: a JSON payload matching ``MultiPeriodRequest``.
Server → client: a sequence of events, each ``{"event": str, ...}``::

    {"event": "started",   "ts": 0.0}
    {"event": "heartbeat", "ts": 1.2, "elapsed": 1.2, "phase": "solving"}
    {"event": "completed", "ts": 2.4, "elapsed": 2.4, "result": MultiPeriodSolution}
    {"event": "failed",    "ts": 0.3, "error": "..."}

cvxpy doesn't expose iteration progress, so heartbeats run on a separate task
and tick every 0.5s while the solve runs.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.network.topologies import get_network
from app.schemas.optimization import MultiPeriodRequest
from app.solvers.multiperiod_opf import solve_multiperiod_dcopf

router = APIRouter(prefix="/ws", tags=["ws"])


async def _heartbeat_loop(ws: WebSocket, start: float, stop_event: asyncio.Event) -> None:
    """Send a heartbeat every 0.5s until ``stop_event`` is set."""
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=0.5)
            return
        except asyncio.TimeoutError:
            elapsed = time.perf_counter() - start
            try:
                await ws.send_json({"event": "heartbeat", "elapsed": elapsed, "phase": "solving"})
            except Exception:
                return


@router.websocket("/solve")
async def solve(ws: WebSocket) -> None:
    await ws.accept()
    try:
        raw = await ws.receive_json()
    except WebSocketDisconnect:
        return
    except Exception as e:
        await ws.send_json({"event": "failed", "error": f"Could not parse request: {e}"})
        await ws.close()
        return

    try:
        req = MultiPeriodRequest.model_validate(raw)
    except ValidationError as e:
        await ws.send_json({"event": "failed", "error": e.errors()})
        await ws.close()
        return

    try:
        network = get_network(req.network)
    except KeyError as e:
        await ws.send_json({"event": "failed", "error": str(e)})
        await ws.close()
        return

    start = time.perf_counter()
    await ws.send_json({"event": "started", "ts": 0.0})

    stop_event = asyncio.Event()
    heartbeat_task = asyncio.create_task(_heartbeat_loop(ws, start, stop_event))

    loop = asyncio.get_running_loop()

    def _solve_sync() -> Any:
        return solve_multiperiod_dcopf(
            network=network,
            horizon_hours=req.horizon_hours,
            timestep_minutes=req.timestep_minutes,
            load_multiplier=req.load_multiplier,
            batteries=req.batteries,
            data_centers=req.data_centers,
            renewables=req.renewables,
            forecast=req.forecast,
        )

    try:
        result = await loop.run_in_executor(None, _solve_sync)
    except Exception as e:
        stop_event.set()
        await heartbeat_task
        await ws.send_json({"event": "failed", "error": str(e)})
        await ws.close()
        return

    stop_event.set()
    await heartbeat_task

    elapsed = time.perf_counter() - start
    await ws.send_json(
        {
            "event": "completed",
            "elapsed": elapsed,
            "result": result.model_dump(),
        }
    )
    await ws.close()
