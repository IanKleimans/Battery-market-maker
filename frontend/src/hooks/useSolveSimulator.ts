/** Hook that runs the multi-period DC-OPF over WebSocket with progress events. */

import { useCallback, useRef } from 'react'
import { streamSolve } from '@/api/ws'
import { useSimulator } from '@/store/simulator'
import { toast } from '@/components/ui'
import type { MultiPeriodRequest } from '@/types/api'

export function useSolveSimulator() {
  const cancelRef = useRef<(() => void) | null>(null)

  const solve = useCallback(() => {
    const s = useSimulator.getState()
    s.setSolving(true)
    s.setSolveError(null)
    s.setMultiResult(null)
    s.setSolveElapsed(null)
    s.setScrubberStep(0)

    const req: MultiPeriodRequest = {
      network: s.network,
      horizon_hours: s.horizonHours,
      timestep_minutes: s.timestepMinutes,
      load_multiplier: s.loadMultiplier,
      batteries: s.batteries,
      data_centers: s.dataCenters,
      renewables: s.renewables,
      forecast: { source: s.forecastSource },
    }

    if (cancelRef.current) cancelRef.current()
    cancelRef.current = streamSolve(req, (e) => {
      if (e.event === 'started') {
        // no-op
      } else if (e.event === 'heartbeat') {
        useSimulator.getState().setSolveElapsed(e.elapsed)
      } else if (e.event === 'completed') {
        useSimulator.getState().setMultiResult(e.result)
        useSimulator.getState().setSolveElapsed(e.elapsed)
        useSimulator.getState().setSolving(false)
        toast('success', {
          title: 'Solved',
          description: `${e.elapsed.toFixed(2)} s · ${e.result.n_timesteps} timesteps`,
        })
      } else if (e.event === 'failed') {
        useSimulator.getState().setSolveError(
          typeof e.error === 'string' ? e.error : JSON.stringify(e.error),
        )
        useSimulator.getState().setSolving(false)
        toast('danger', {
          title: 'Solve failed',
          description: typeof e.error === 'string' ? e.error : 'See console for details',
        })
      }
    })
  }, [])

  const cancel = useCallback(() => {
    cancelRef.current?.()
    useSimulator.getState().setSolving(false)
  }, [])

  return { solve, cancel }
}
