/** FrameState from the single-period (Live) result.
 *
 * Defensively normalizes possibly-empty maps so downstream rendering can index
 * freely. Returns `undefined` only when there's no result at all. Also
 * appends each bus's LMP sample to the rolling history buffer used by the
 * hover sparkline. */

import { useEffect, useMemo } from 'react'
import type { FrameState } from '@/components/network/NetworkDiagram'
import type { SinglePeriodSolution } from '@/types/api'
import { pushLMPSample } from './useLMPHistory'

export function useLiveFrame(result: SinglePeriodSolution | null): FrameState | undefined {
  // Append a history sample for every bus the moment a new result lands.
  useEffect(() => {
    if (!result) return
    const lmps = result.bus_lmp ?? {}
    for (const [bus, v] of Object.entries(lmps)) {
      pushLMPSample(Number(bus), 'live', v)
    }
  }, [result])

  return useMemo(() => {
    if (!result) return undefined
    return {
      genOutput: result.generator_output ?? {},
      lineFlow: result.line_flow ?? {},
      lineUtil: result.line_utilization ?? {},
      busLMP: result.bus_lmp ?? {},
      busLoad: result.bus_load ?? {},
    }
  }, [result])
}
