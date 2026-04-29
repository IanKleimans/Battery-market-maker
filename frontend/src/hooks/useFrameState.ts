/** Derive a per-timestep FrameState for the NetworkDiagram from the current
 * MultiPeriodSolution and scrubber position. */

import { useMemo } from 'react'
import type { FrameState } from '@/components/network/NetworkDiagram'
import { useSimulator } from '@/store/simulator'
import type { MultiPeriodSolution, NetworkData } from '@/types/api'

export function useFrameState(
  result: MultiPeriodSolution | null,
  network: NetworkData | null,
): FrameState | undefined {
  const step = useSimulator((s) => s.scrubberStep)
  const batteries = useSimulator((s) => s.batteries)
  const dataCenters = useSimulator((s) => s.dataCenters)
  const renewables = useSimulator((s) => s.renewables)

  return useMemo(() => {
    if (!result || !network) return undefined
    const t = Math.max(0, Math.min(result.n_timesteps - 1, step))

    const genOutput: Record<number, number> = {}
    for (const g of result.generator_dispatch) genOutput[g.gen_id] = g.p_mw[t] ?? 0

    const lineFlow: Record<number, number> = {}
    const lineUtil: Record<number, number> = {}
    for (const l of result.line_flows) {
      lineFlow[l.line_id] = l.flow_mw[t] ?? 0
      lineUtil[l.line_id] = l.utilization[t] ?? 0
    }

    const busLMP: Record<number, number> = {}
    for (const lmp of result.lmps) busLMP[lmp.bus] = lmp.lmp_per_mwh[t] ?? 0

    // Bus load is not on the per-step result — back-out from generator dispatch
    // and stored network. For the diagram we just show the static peak load.
    const busLoad: Record<number, number> = {}
    for (const ld of network.loads) busLoad[ld.bus] = (busLoad[ld.bus] ?? 0) + ld.peak_mw

    const batterySOC: Record<string, number> = {}
    const batteryNet: Record<string, number> = {}
    for (const traj of result.battery_trajectories) {
      const cfg = batteries.find((b) => b.id === traj.asset_id)
      const cap = cfg?.e_max_mwh ?? 1
      batterySOC[traj.asset_id] = (traj.soc_mwh[t] ?? 0) / cap
      batteryNet[traj.asset_id] =
        (traj.discharge_mw[t] ?? 0) - (traj.charge_mw[t] ?? 0)
    }

    const dcUtil: Record<string, number> = {}
    for (const traj of result.data_center_trajectories) {
      dcUtil[traj.asset_id] = traj.utilization[t] ?? 0
    }

    const renewFrac: Record<string, number> = {}
    for (const traj of result.renewable_trajectories) {
      const cfg = renewables.find((r) => r.id === traj.asset_id)
      const cap = cfg?.capacity_mw ?? 1
      renewFrac[traj.asset_id] = (traj.delivered_mw[t] ?? 0) / cap
    }

    return {
      genOutput,
      lineFlow,
      lineUtil,
      busLMP,
      busLoad,
      batterySOC,
      batteryNet,
      dcUtil,
      renewFrac,
    }
  }, [result, network, step, batteries, renewables, dataCenters])
}
