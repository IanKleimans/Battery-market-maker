/** Tiny background poller for the FastAPI /health endpoint.
 *
 * Drives the green/red dot in the persistent footer. Polls every 30 s,
 * with a 5 s timeout per request so a hung backend doesn't block the UI. */

import { useEffect, useState } from 'react'

const HEALTH_PATH = '/api/v1/health'
const POLL_INTERVAL_MS = 30_000
const REQUEST_TIMEOUT_MS = 5_000

export type HealthState = 'unknown' | 'healthy' | 'degraded' | 'down'

interface HealthSnapshot {
  state: HealthState
  /** Round-trip time in ms for the most recent ping */
  rtt_ms: number | null
  /** Timestamp of last successful response */
  last_ok_at: number | null
}

const INITIAL: HealthSnapshot = {
  state: 'unknown',
  rtt_ms: null,
  last_ok_at: null,
}

export function useApiHealth(): HealthSnapshot {
  const [snap, setSnap] = useState<HealthSnapshot>(INITIAL)

  useEffect(() => {
    let cancelled = false
    const ping = async (): Promise<void> => {
      const ctrl = new AbortController()
      const t = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
      const t0 = performance.now()
      try {
        const base =
          (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || ''
        const r = await fetch(`${base}${HEALTH_PATH}`, { signal: ctrl.signal })
        const elapsed = performance.now() - t0
        if (cancelled) return
        if (r.ok) {
          setSnap({
            state: elapsed > 1500 ? 'degraded' : 'healthy',
            rtt_ms: Math.round(elapsed),
            last_ok_at: Date.now(),
          })
        } else {
          setSnap((prev) => ({ ...prev, state: 'degraded', rtt_ms: Math.round(elapsed) }))
        }
      } catch {
        if (cancelled) return
        setSnap((prev) => ({ ...prev, state: 'down', rtt_ms: null }))
      } finally {
        window.clearTimeout(t)
      }
    }

    void ping()
    const id = window.setInterval(() => void ping(), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return snap
}
