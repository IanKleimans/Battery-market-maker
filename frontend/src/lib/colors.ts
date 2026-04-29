/** Color helpers — fuel colors, congestion ramps, LMP gradients. */

import type { FuelType } from '@/types/api'

export const FUEL_COLORS: Record<FuelType, string> = {
  coal: '#737373',
  gas: '#f59e0b',
  nuclear: '#a855f7',
  hydro: '#06b6d4',
  wind: '#22d3ee',
  solar: '#fde047',
  oil: '#dc2626',
}

/** 0..1 utilization → color: green at 0, yellow at 0.7, red at >=1 */
export function utilizationColor(u: number): string {
  const x = Math.max(0, Math.min(1.2, u))
  if (x < 0.6) return '#10b981'
  if (x < 0.85) return '#f59e0b'
  return '#ef4444'
}

/** LMP ($/MWh) → blue→amber→red gradient, anchored on a min/max range. */
export function lmpColor(lmp: number, min: number, max: number): string {
  if (max - min < 1e-6) return '#2563eb'
  const t = Math.max(0, Math.min(1, (lmp - min) / (max - min)))
  // 3-stop gradient
  if (t < 0.5) {
    const u = t / 0.5
    return mix('#2563eb', '#f59e0b', u)
  }
  const u = (t - 0.5) / 0.5
  return mix('#f59e0b', '#ef4444', u)
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}
