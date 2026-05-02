/** Per-bus rolling LMP history for the bus-hover sparkline.
 *
 * Subscribes to the live single-period result and appends a sample whenever
 * the LMP at the watched bus changes. Keeps at most `windowMs` of samples,
 * dropping anything older. Works for both Live and Optimization modes — the
 * caller passes whichever LMP source matches the current frame. */

import { useEffect, useRef, useState } from 'react'

const DEFAULT_WINDOW_MS = 60_000
const MAX_SAMPLES = 200

interface Sample {
  t: number
  v: number
}

const buffers = new Map<string, Sample[]>()

function key(busId: number, channel: string): string {
  return `${channel}:${busId}`
}

/** Push a new LMP sample for (busId, channel). Channel separates Live vs
 * Optimization-mode buffers so they don't blend together. */
export function pushLMPSample(busId: number, channel: string, lmp: number): void {
  if (!Number.isFinite(lmp)) return
  const k = key(busId, channel)
  const buf = buffers.get(k) ?? []
  buf.push({ t: Date.now(), v: lmp })
  // Trim length and drop stale samples
  const cutoff = Date.now() - DEFAULT_WINDOW_MS
  while (buf.length > 0 && buf[0]!.t < cutoff) buf.shift()
  if (buf.length > MAX_SAMPLES) buf.splice(0, buf.length - MAX_SAMPLES)
  buffers.set(k, buf)
}

/** Subscribe to the rolling history of LMPs at busId. Returns the current
 * samples on each call; the consumer re-renders on new samples by polling
 * (cheap enough at 250 ms; avoids the cost of a global pubsub for one chart). */
export function useLMPHistory(
  busId: number | null | undefined,
  channel = 'live',
  pollMs = 250,
): Sample[] {
  const [, setTick] = useState(0)
  const lastLen = useRef(0)
  useEffect(() => {
    if (busId === null || busId === undefined) return
    const id = window.setInterval(() => {
      const buf = buffers.get(key(busId, channel)) ?? []
      if (buf.length !== lastLen.current) {
        lastLen.current = buf.length
        setTick((x) => x + 1)
      }
    }, pollMs)
    return () => window.clearInterval(id)
  }, [busId, channel, pollMs])
  if (busId === null || busId === undefined) return []
  return buffers.get(key(busId, channel)) ?? []
}

export function clearLMPHistory(channel?: string): void {
  if (!channel) {
    buffers.clear()
    return
  }
  for (const k of [...buffers.keys()]) {
    if (k.startsWith(`${channel}:`)) buffers.delete(k)
  }
}
