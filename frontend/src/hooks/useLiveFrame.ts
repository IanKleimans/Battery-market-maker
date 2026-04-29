/** FrameState from the single-period (Live) result. */

import { useMemo } from 'react'
import type { FrameState } from '@/components/network/NetworkDiagram'
import type { SinglePeriodSolution } from '@/types/api'

export function useLiveFrame(result: SinglePeriodSolution | null): FrameState | undefined {
  return useMemo(() => {
    if (!result) return undefined
    return {
      genOutput: result.generator_output,
      lineFlow: result.line_flow,
      lineUtil: result.line_utilization,
      busLMP: result.bus_lmp,
      busLoad: result.bus_load,
    }
  }, [result])
}
