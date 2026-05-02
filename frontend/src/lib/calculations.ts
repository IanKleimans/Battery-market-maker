/** Pure derivations exposed to the "Show calculations" panels.
 *
 * Everything in this file is computable from the existing API responses; no
 * extra network call is needed to render the calculations UIs. Keeps the
 * teaching surface fast (<1 ms recompute per render) and explicit. */

import type {
  Generator,
  LineFlowPoint,
  MultiPeriodSolution,
  NetworkData,
  SinglePeriodSolution,
} from '@/types/api'

const BINDING_THRESHOLD = 0.99

export interface DispatchedGenerator {
  gen: Generator
  output_mw: number
  utilization: number
  cost_per_hour: number
}

/** Returns generators sorted by marginal cost ascending (merit order),
 * with their current dispatch. Includes idle generators at the bottom. */
export function meritOrderDispatch(
  network: NetworkData,
  genOutput: Record<number, number>,
): DispatchedGenerator[] {
  return network.generators
    .map((gen) => {
      const output = genOutput[gen.id] ?? 0
      const utilization = gen.capacity_mw > 0 ? output / gen.capacity_mw : 0
      return {
        gen,
        output_mw: output,
        utilization,
        cost_per_hour: output * gen.cost_per_mwh,
      }
    })
    .sort((a, b) => {
      // Active generators first, by cost. Idle generators at the bottom by cost.
      const aActive = a.output_mw > 0.01 ? 1 : 0
      const bActive = b.output_mw > 0.01 ? 1 : 0
      if (aActive !== bActive) return bActive - aActive
      return a.gen.cost_per_mwh - b.gen.cost_per_mwh
    })
}

export interface LMPDecomposition {
  /** Reference (slack) bus LMP — the system-wide energy price */
  energy: number
  /** LMP at this bus minus energy — local congestion contribution */
  congestion: number
  /** Total LMP at this bus = energy + congestion (DC-OPF: no losses term) */
  total: number
}

/** Decompose an LMP into energy + congestion using the slack bus as reference.
 *
 * In a lossless DC-OPF with a single slack bus, LMP_i = lambda + mu_i, where
 * lambda equals the LMP at the slack bus (no congestion contribution there)
 * and mu_i is the local congestion shadow price. */
export function lmpDecomposition(
  network: NetworkData,
  busLMP: Record<number, number>,
  busId: number,
): LMPDecomposition | null {
  const slack = network.buses.find((b) => b.is_slack)
  if (!slack) return null
  const energy = busLMP[slack.id]
  const total = busLMP[busId]
  if (typeof energy !== 'number' || typeof total !== 'number') return null
  return { energy, congestion: total - energy, total }
}

export interface BindingLine {
  line_id: number
  name: string
  from_bus: number
  to_bus: number
  capacity_mw: number
  utilization: number
  flow_mw: number
}

/** Identify lines that are at or near their thermal limit at a single point in time. */
export function bindingLinesAt(
  network: NetworkData,
  lineFlow: Record<number, number>,
  lineUtil: Record<number, number>,
): BindingLine[] {
  return network.lines
    .map((ln) => ({
      line_id: ln.id,
      name: ln.name,
      from_bus: ln.from_bus,
      to_bus: ln.to_bus,
      capacity_mw: ln.capacity_mva,
      utilization: lineUtil[ln.id] ?? 0,
      flow_mw: lineFlow[ln.id] ?? 0,
    }))
    .filter((l) => l.utilization >= BINDING_THRESHOLD)
    .sort((a, b) => b.utilization - a.utilization)
}

/** Total objective per hour at this snapshot — sum of generator costs. */
export function objectiveValuePerHour(dispatched: DispatchedGenerator[]): number {
  return dispatched.reduce((acc, g) => acc + g.cost_per_hour, 0)
}

export interface BindingLineHorizon {
  line_id: number
  name: string
  from_bus: number
  to_bus: number
  /** Number of timesteps where utilization >= threshold */
  binding_steps: number
  /** Peak utilization observed across the horizon (>1 means overload) */
  peak_utilization: number
}

/** Across the optimization horizon, find lines that bound the dispatch at
 * least once. Used by the Solver Trace drawer in Optimization mode. */
export function bindingLinesHorizon(
  network: NetworkData,
  lineFlows: LineFlowPoint[],
): BindingLineHorizon[] {
  const lineById = new Map(network.lines.map((l) => [l.id, l]))
  return lineFlows
    .map((lf) => {
      const ln = lineById.get(lf.line_id)
      if (!ln) return null
      let binding = 0
      let peak = 0
      for (const u of lf.utilization) {
        if (u > peak) peak = u
        if (u >= BINDING_THRESHOLD) binding += 1
      }
      return {
        line_id: lf.line_id,
        name: ln.name,
        from_bus: ln.from_bus,
        to_bus: ln.to_bus,
        binding_steps: binding,
        peak_utilization: peak,
      } as BindingLineHorizon
    })
    .filter((x): x is BindingLineHorizon => x !== null && x.binding_steps > 0)
    .sort((a, b) => b.peak_utilization - a.peak_utilization)
}

export interface ObjectiveDecomposition {
  fuel_cost: number
  battery_degradation: number
  battery_energy_revenue: number
  data_center_compute_revenue: number
  data_center_sla_penalty: number
  renewable_energy_revenue: number
  renewable_curtailment_penalty: number
  total: number
}

/** Decompose the multi-period objective into the components surfaced on the
 * Revenue tab, expressed at the system-cost-minimization sign convention so
 * "battery_energy_revenue" appears as a negative cost the optimizer chases.
 *
 * Total here equals total_system_cost from the solution to within rounding. */
export function objectiveDecomposition(
  result: MultiPeriodSolution,
): ObjectiveDecomposition {
  // The total_system_cost reported by the solver is the canonical answer;
  // the per-asset revenue rows let us split it by source.
  let battEnergy = 0
  let battDeg = 0
  let dcCompute = 0
  let dcSla = 0
  let renEnergy = 0
  let renCurt = 0
  for (const r of result.revenue) {
    if (r.asset_kind === 'battery') {
      battEnergy += r.energy_revenue
      battDeg += r.degradation_cost
    } else if (r.asset_kind === 'data_center') {
      dcCompute += r.compute_revenue
      dcSla += r.sla_penalty
    } else if (r.asset_kind === 'renewable') {
      renEnergy += r.energy_revenue
      renCurt += r.curtailment_penalty
    }
  }
  // Fuel cost = total + asset revenues (since asset revenues are subtracted
  // inside the objective). Approximation: degradation/penalty already inside.
  const fuel =
    result.total_system_cost +
    battEnergy -
    battDeg +
    dcCompute -
    dcSla +
    renEnergy -
    renCurt
  return {
    fuel_cost: fuel,
    battery_degradation: battDeg,
    battery_energy_revenue: battEnergy,
    data_center_compute_revenue: dcCompute,
    data_center_sla_penalty: dcSla,
    renewable_energy_revenue: renEnergy,
    renewable_curtailment_penalty: renCurt,
    total: result.total_system_cost,
  }
}

/** Convenience: how many variables, constraints, status, solver, wall time. */
export function problemStats(result: MultiPeriodSolution | SinglePeriodSolution) {
  return {
    solver: result.solver_stats?.solver ?? 'HIGHS',
    n_variables: result.solver_stats?.n_variables ?? 0,
    n_constraints: result.solver_stats?.n_constraints ?? 0,
    status: result.status,
    solve_time_seconds: result.solve_time_seconds,
  }
}
