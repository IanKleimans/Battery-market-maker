/** Run the single-period DC-OPF on every slider change, debounced. */

import { useEffect, useRef } from 'react'
import { api } from '@/api/client'
import { useSimulator } from '@/store/simulator'

const DEBOUNCE_MS = 120

export function useLiveDispatch(active: boolean) {
  const tHandle = useRef<number | undefined>(undefined)
  const reqId = useRef(0)

  const network = useSimulator((s) => s.network)
  const loadMul = useSimulator((s) => s.loadMultiplier)
  const wind = useSimulator((s) => s.windAvailability)
  const setLive = useSimulator((s) => s.setLiveResult)

  useEffect(() => {
    if (!active) return
    if (tHandle.current) window.clearTimeout(tHandle.current)
    tHandle.current = window.setTimeout(() => {
      const myId = ++reqId.current
      api
        .singleperiodOPF({
          network,
          load_multiplier: loadMul,
          wind_availability: wind,
          line_capacity_overrides: {},
        })
        .then((r) => {
          // ignore stale responses
          if (myId !== reqId.current) return
          setLive(r)
        })
        .catch(() => {
          if (myId !== reqId.current) return
          setLive(null)
        })
    }, DEBOUNCE_MS)
    return () => {
      if (tHandle.current) window.clearTimeout(tHandle.current)
    }
  }, [active, network, loadMul, wind, setLive])
}
