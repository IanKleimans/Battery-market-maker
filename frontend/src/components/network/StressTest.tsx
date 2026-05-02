/** Scripted "stress the grid" demo for Live mode.
 *
 * Drives the existing override sliders over a fixed timeline:
 *   0–30 s   load ramps from 100% to 200%
 *   30 s     trip the most-loaded line
 *   45 s     force the largest non-renewable generator offline
 *   60 s     stop and report what happened
 *
 * State updates flow through the normal simulator store, so the network
 * diagram, charts, and calculations panels all animate as the user watches. */

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui'
import { useSimulator } from '@/store/simulator'
import type { NetworkData } from '@/types/api'

export interface StressTestProps {
  network: NetworkData
}

interface Step {
  t_seconds: number
  label: string
  apply: (network: NetworkData) => void
}

const TICK_MS = 250

export function StressTest({ network }: StressTestProps) {
  const [running, setRunning] = useState(false)
  const [tick, setTick] = useState(0)
  const tHandle = useRef<number | undefined>(undefined)
  const setLoadMul = useSimulator((s) => s.setLoadMultiplier)
  const setOutage = useSimulator((s) => s.setLineOutage)
  const setGenOverride = useSimulator((s) => s.setGenOverride)
  const reset = useSimulator((s) => s.resetLiveOverrides)
  const liveResult = useSimulator((s) => s.liveResult)

  const totalSeconds = 60
  const elapsed = (tick * TICK_MS) / 1000
  const progress = Math.min(1, elapsed / totalSeconds)

  // Find the largest line and largest non-renewable gen at start
  const targets = useRef<{ line_id: number; gen_id: number } | null>(null)

  const steps: Step[] = [
    {
      t_seconds: 0,
      label: 'Load ramp begins',
      apply: () => setLoadMul(1.0),
    },
    {
      t_seconds: 30,
      label: 'Trip the most-loaded line',
      apply: () => {
        if (!targets.current) return
        setOutage(targets.current.line_id, true)
      },
    },
    {
      t_seconds: 45,
      label: 'Force the largest fossil generator offline',
      apply: () => {
        if (!targets.current) return
        setGenOverride(targets.current.gen_id, { online: false })
      },
    },
  ]

  const start = (): void => {
    // Snapshot targets at the moment we start.
    const fossil = network.generators
      .filter((g) => g.fuel === 'coal' || g.fuel === 'gas' || g.fuel === 'oil')
      .sort((a, b) => b.capacity_mw - a.capacity_mw)[0]
    const candidate = liveResult
      ? Object.entries(liveResult.line_utilization)
          .map(([id, u]) => ({ id: Number(id), u }))
          .sort((a, b) => b.u - a.u)[0]
      : null
    const fallbackLine = network.lines.sort((a, b) => b.capacity_mva - a.capacity_mva)[0]
    targets.current = {
      gen_id: fossil?.id ?? network.generators[0]!.id,
      line_id: candidate?.id ?? fallbackLine!.id,
    }
    setTick(0)
    setRunning(true)
  }

  const stop = (): void => {
    setRunning(false)
    if (tHandle.current) window.clearInterval(tHandle.current)
  }

  const fullReset = (): void => {
    stop()
    reset()
    setTick(0)
  }

  // The driver loop — advances tick and applies ramp + step events.
  useEffect(() => {
    if (!running) return
    tHandle.current = window.setInterval(() => {
      setTick((prev) => {
        const next = prev + 1
        const t = (next * TICK_MS) / 1000
        // Linear ramp from 1.0 to 2.0 across the first 30 seconds.
        if (t <= 30) {
          setLoadMul(1.0 + (t / 30) * 1.0)
        }
        // Fire step actions exactly once when crossing their threshold.
        for (const s of steps) {
          const prevT = (prev * TICK_MS) / 1000
          if (prevT < s.t_seconds && t >= s.t_seconds) {
            s.apply(network)
          }
        }
        if (t >= totalSeconds) {
          if (tHandle.current) window.clearInterval(tHandle.current)
          setRunning(false)
        }
        return next
      })
    }, TICK_MS)
    return () => {
      if (tHandle.current) window.clearInterval(tHandle.current)
    }
    // We intentionally don't depend on `steps` (recreated each render);
    // the interval reads the latest functions through closure capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, network])

  const currentLabel = (() => {
    let last = 'Idle'
    for (const s of steps) {
      if (elapsed >= s.t_seconds) last = s.label
    }
    if (elapsed >= totalSeconds) last = 'Done — inspect the network'
    return last
  })()

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-text-2">
        A 60-second scripted demo: the load ramps from 100% to 200%, then the
        most-loaded line trips, then the largest fossil generator goes offline.
        Watch the LMPs respond.
      </p>
      <div className="flex items-center gap-2">
        {!running ? (
          <Button size="sm" onClick={start} disabled={running}>
            <Play size={12} /> Run
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={stop}>
            <Pause size={12} /> Pause
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={fullReset}>
          <RotateCcw size={12} /> Reset
        </Button>
        <span className="text-[10px] mono text-text-2 ml-auto">
          {elapsed.toFixed(1)} / {totalSeconds.toFixed(0)} s
        </span>
      </div>
      <div className="h-1 bg-border rounded overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="text-[11px] text-text-1 mono">{currentLabel}</div>
    </div>
  )
}
