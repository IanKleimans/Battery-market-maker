/** FrameState from the single-period (Live) result.
 *
 * Defensively normalizes possibly-empty maps so downstream rendering can index
 * freely. Returns `undefined` only when there's no result at all. */

import { useMemo } from 'react'
import type { FrameState } from '@/components/network/NetworkDiagram'
import type { SinglePeriodSolution } from '@/types/api'

export function useLiveFrame(result: SinglePeriodSolution | null): FrameState | undefined {
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
