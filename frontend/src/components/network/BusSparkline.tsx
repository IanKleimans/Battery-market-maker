/** Mini SVG sparkline of LMP history at a single bus. Used inside hover tooltips.
 *
 * No external dependency; renders a path on a fixed viewBox so it scales
 * cleanly. Shows a single horizontal reference line at the mean. */

import { useMemo } from 'react'
import { useLMPHistory } from '@/hooks/useLMPHistory'

export interface BusSparklineProps {
  busId: number
  /** which buffer channel ("live" or "opt"); see useLMPHistory */
  channel?: string
  width?: number
  height?: number
  color?: string
}

export function BusSparkline({
  busId,
  channel = 'live',
  width = 120,
  height = 28,
  color = '#2563eb',
}: BusSparklineProps) {
  const samples = useLMPHistory(busId, channel)

  const { d, mean, range, count } = useMemo(() => {
    if (samples.length < 2) return { d: '', mean: 0, range: [0, 0] as [number, number], count: samples.length }
    const vals = samples.map((s) => s.v)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const m = vals.reduce((a, b) => a + b, 0) / vals.length
    const xs = samples.map((s) => s.t)
    const t0 = xs[0]!
    const tn = xs[xs.length - 1]!
    const tspan = Math.max(1, tn - t0)
    const yspan = Math.max(0.001, max - min)
    const points = samples.map((s, i) => {
      const x = ((s.t - t0) / tspan) * width
      const y = height - ((s.v - min) / yspan) * (height - 2) - 1
      return [x, y, i] as const
    })
    const path = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ')
    return { d: path, mean: m, range: [min, max] as [number, number], count: samples.length }
  }, [samples, width, height])

  if (count < 2) {
    return (
      <div className="text-[10px] text-text-3 mono italic">
        Collecting LMP history…
      </div>
    )
  }

  // Mean line position
  const yMean = (() => {
    if (range[1] - range[0] < 0.001) return height / 2
    return height - ((mean - range[0]) / (range[1] - range[0])) * (height - 2) - 1
  })()

  return (
    <div className="text-[10px] mono text-text-3 space-y-0.5">
      <svg width={width} height={height} className="block">
        <line
          x1={0}
          y1={yMean}
          x2={width}
          y2={yMean}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeDasharray="2,2"
        />
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
      <div className="flex justify-between">
        <span>${range[0].toFixed(1)}</span>
        <span>µ ${mean.toFixed(1)}</span>
        <span>${range[1].toFixed(1)}</span>
      </div>
    </div>
  )
}
