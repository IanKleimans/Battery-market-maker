/** Run the single-period DC-OPF on every slider change.
 *
 * Three layers of staleness protection:
 *   1. Debounce (DEBOUNCE_MS) — collapses rapid slider events into one fetch.
 *   2. AbortController — cancels the in-flight request when a new one starts.
 *   3. Sequence token (reqId) — ignores responses that arrive out of order.
 *
 * Loading state lives on the simulator store so any panel can show a
 * "recomputing" indicator without prop-drilling. */

import { useEffect, useRef } from 'react'
import { ApiError, api } from '@/api/client'
import { useSimulator } from '@/store/simulator'

const DEBOUNCE_MS = 100

export function useLiveDispatch(active: boolean) {
  const tHandle = useRef<number | undefined>(undefined)
  const reqId = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const network = useSimulator((s) => s.network)
  const loadMul = useSimulator((s) => s.loadMultiplier)
  const wind = useSimulator((s) => s.windAvailability)
  const overrides = useSimulator((s) => s.liveOverrides)
  const setLive = useSimulator((s) => s.setLiveResult)
  const setLiveLoading = useSimulator((s) => s.setLiveLoading)
  const setLiveError = useSimulator((s) => s.setLiveError)

  useEffect(() => {
    if (!active) return

    if (tHandle.current) window.clearTimeout(tHandle.current)
    tHandle.current = window.setTimeout(() => {
      const myId = ++reqId.current
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLiveLoading(true)
      setLiveError(null)
      api
        .singleperiodOPF(
          {
            network,
            load_multiplier: loadMul,
            wind_availability: wind,
            line_capacity_overrides: overrides.lineCaps,
            line_outages: overrides.lineOutages,
            load_overrides: overrides.loads,
            gen_overrides: overrides.gens,
          },
          { signal: controller.signal },
        )
        .then((r) => {
          if (myId !== reqId.current) return
          setLive(r)
          setLiveLoading(false)
        })
        .catch((e: unknown) => {
          // AbortError on stale-cancel is the expected path, not an error.
          if (e instanceof DOMException && e.name === 'AbortError') return
          if (myId !== reqId.current) return
          setLive(null)
          setLiveLoading(false)
          if (e instanceof ApiError) {
            setLiveError(`Backend ${e.status}: ${e.message}`)
          } else if (e instanceof Error) {
            setLiveError(e.message)
          } else {
            setLiveError('Live solve failed')
          }
        })
    }, DEBOUNCE_MS)

    return () => {
      if (tHandle.current) window.clearTimeout(tHandle.current)
      // Don't abort on unmount-while-pending — let the response settle so the
      // store stays consistent. The reqId guard drops it if stale.
    }
  }, [active, network, loadMul, wind, overrides, setLive, setLiveLoading, setLiveError])
}
