/** Time scrubber: drag/click to scrub through the optimization horizon, with
 * play/pause and a thin background showing system-wide cost over time. */

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import * as RadixSlider from '@radix-ui/react-slider'
import { useSimulator } from '@/store/simulator'
import type { MultiPeriodSolution } from '@/types/api'
import { formatHourLabel } from '@/lib/format'

export function TimeScrubber({ result }: { result: MultiPeriodSolution }) {
  const step = useSimulator((s) => s.scrubberStep)
  const setStep = useSimulator((s) => s.setScrubberStep)
  const playing = useSimulator((s) => s.isPlaying)
  const setPlaying = useSimulator((s) => s.setPlaying)

  const max = result.n_timesteps - 1
  const ts = result.timestamps[step] ?? result.timestamps[0]

  // Cost-proxy sparkline: slack-bus LMP × aggregate line-flow magnitude.
  // Used purely as a backdrop hint — exact cost lives in the Dispatch tab.
  const costPerStep = useMemo(() => {
    const n = result.n_timesteps
    const dt = result.timestep_minutes / 60
    const out = new Float32Array(n)
    const slackLMP = result.lmps[0]?.lmp_per_mwh ?? []
    for (let t = 0; t < n; t++) {
      let lt = 0
      for (const ld of result.line_flows) lt += Math.abs(ld.flow_mw[t] ?? 0)
      out[t] = (slackLMP[t] ?? 0) * (lt / 50) * dt
    }
    return out
  }, [result])

  // Play loop
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setStep(Math.min(max, useSimulator.getState().scrubberStep + 1))
      if (useSimulator.getState().scrubberStep >= max) {
        setPlaying(false)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [playing, max, setStep, setPlaying])

  // Mini bar chart of cost
  const maxCost = useMemo(() => {
    let m = 0
    for (let i = 0; i < costPerStep.length; i++) m = Math.max(m, costPerStep[i] ?? 0)
    return m || 1
  }, [costPerStep])

  return (
    <div className="border-t border-border bg-surface/60 px-4 pt-2 pb-3">
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          aria-label="Jump to start"
          onClick={() => setStep(0)}
          className="text-text-2 hover:text-text-1"
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying(!playing)}
          className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover"
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          type="button"
          aria-label="Jump to end"
          onClick={() => setStep(max)}
          className="text-text-2 hover:text-text-1"
        >
          <SkipForward size={14} />
        </button>
        <div className="text-[11px] text-text-2 mono ml-2">
          Step <span className="text-text-1">{step + 1}</span> / {result.n_timesteps}
          <span className="ml-3">{formatHourLabel(ts)} UTC</span>
        </div>
      </div>

      {/* Cost background + scrubber */}
      <div className="relative h-12">
        <svg
          viewBox={`0 0 ${result.n_timesteps} 100`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-40"
        >
          {Array.from(costPerStep).map((c, i) => (
            <rect
              key={i}
              x={i}
              y={100 - (c / maxCost) * 100}
              width={1}
              height={(c / maxCost) * 100}
              fill="#2563eb"
            />
          ))}
        </svg>
        <RadixSlider.Root
          className="relative w-full h-full select-none touch-none flex items-center"
          value={[step]}
          onValueChange={(v) => setStep(v[0]!)}
          min={0}
          max={max}
          step={1}
        >
          <RadixSlider.Track className="bg-border relative grow rounded-full h-1">
            <RadixSlider.Range className="absolute rounded-full h-full bg-accent/70" />
          </RadixSlider.Track>
          <RadixSlider.Thumb
            className="block w-5 h-5 bg-white border-2 border-accent rounded-full shadow-card cursor-grab active:cursor-grabbing"
            aria-label="Scrubber"
          />
        </RadixSlider.Root>
        {/* Hour ticks */}
        <div className="absolute -bottom-4 left-0 right-0 flex justify-between pointer-events-none">
          {result.timestamps
            .map((t, i) => ({ t, i }))
            .filter(
              (_, i, arr) =>
                arr.length <= 24 ||
                i % Math.ceil(arr.length / 24) === 0 ||
                i === arr.length - 1,
            )
            .map(({ t, i }) => (
              <span key={i} className="text-[9px] text-text-2 mono">
                {formatHourLabel(t)}
              </span>
            ))}
        </div>
      </div>
    </div>
  )
}
