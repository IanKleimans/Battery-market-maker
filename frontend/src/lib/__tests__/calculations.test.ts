import { describe, it, expect } from 'vitest'
import {
  bindingLinesAt,
  bindingLinesHorizon,
  lmpDecomposition,
  meritOrderDispatch,
  objectiveDecomposition,
  objectiveValuePerHour,
  problemStats,
} from '../calculations'
import type {
  Generator,
  LineFlowPoint,
  MultiPeriodSolution,
  NetworkData,
  RevenueBreakdown,
  SolverStats,
} from '@/types/api'

const stats: SolverStats = { solver: 'HIGHS', n_variables: 10, n_constraints: 20 }

function gen(id: number, cost: number, cap: number, fuel: Generator['fuel'] = 'gas'): Generator {
  return {
    id,
    bus: id,
    name: `G${id}`,
    fuel,
    capacity_mw: cap,
    cost_per_mwh: cost,
    ramp_rate_mw_per_min: 100,
    min_output_mw: 0,
  }
}

const network: NetworkData = {
  name: 'ieee14',
  display_name: 'IEEE 14',
  base_mva: 100,
  buses: [
    { id: 1, name: 'B1', base_kv: 138, x: 0, y: 0, is_slack: true },
    { id: 2, name: 'B2', base_kv: 138, x: 100, y: 0, is_slack: false },
    { id: 3, name: 'B3', base_kv: 138, x: 200, y: 0, is_slack: false },
  ],
  lines: [
    { id: 1, from_bus: 1, to_bus: 2, name: 'L1-2', reactance: 0.1, capacity_mva: 100 },
    { id: 2, from_bus: 2, to_bus: 3, name: 'L2-3', reactance: 0.1, capacity_mva: 80 },
  ],
  generators: [gen(1, 20, 200, 'coal'), gen(2, 50, 100, 'gas'), gen(3, 5, 150, 'nuclear')],
  loads: [],
}

describe('meritOrderDispatch', () => {
  it('orders active generators by cost ascending, idle generators at bottom', () => {
    const out = meritOrderDispatch(network, { 1: 100, 2: 0, 3: 150 })
    expect(out[0]!.gen.id).toBe(3) // nuclear cheapest, dispatched
    expect(out[1]!.gen.id).toBe(1) // coal next
    expect(out[2]!.gen.id).toBe(2) // gas idle, last
  })

  it('returns zero output for missing generator entries', () => {
    const out = meritOrderDispatch(network, {})
    expect(out.every((d) => d.output_mw === 0)).toBe(true)
  })

  it('cost_per_hour matches output * marginal cost', () => {
    const out = meritOrderDispatch(network, { 1: 100, 2: 0, 3: 0 })
    const coal = out.find((d) => d.gen.id === 1)!
    expect(coal.cost_per_hour).toBe(100 * 20)
  })
})

describe('lmpDecomposition', () => {
  it('decomposes LMP into energy + congestion using slack bus', () => {
    const decomp = lmpDecomposition(network, { 1: 25, 2: 30, 3: 45 }, 3)
    expect(decomp?.energy).toBe(25)
    expect(decomp?.congestion).toBe(20)
    expect(decomp?.total).toBe(45)
  })

  it('returns null when bus or slack is missing', () => {
    expect(lmpDecomposition(network, { 1: 25 }, 99)).toBeNull()
  })
})

describe('bindingLinesAt', () => {
  it('returns lines at or above 99% utilization, sorted by utilization desc', () => {
    const result = bindingLinesAt(network, { 1: 100, 2: 79 }, { 1: 1.0, 2: 0.99 })
    expect(result).toHaveLength(2)
    expect(result[0]!.line_id).toBe(1)
    expect(result[1]!.line_id).toBe(2)
  })

  it('returns empty when no lines are binding', () => {
    expect(bindingLinesAt(network, { 1: 50, 2: 40 }, { 1: 0.5, 2: 0.5 })).toEqual([])
  })
})

describe('objectiveValuePerHour', () => {
  it('sums per-hour costs', () => {
    const dispatched = meritOrderDispatch(network, { 1: 100, 2: 0, 3: 100 })
    expect(objectiveValuePerHour(dispatched)).toBe(100 * 20 + 100 * 5)
  })
})

describe('bindingLinesHorizon', () => {
  it('counts binding timesteps and reports peak utilization', () => {
    const flows: LineFlowPoint[] = [
      { line_id: 1, flow_mw: [50, 100, 60], utilization: [0.5, 1.0, 0.6] },
      { line_id: 2, flow_mw: [10, 20, 30], utilization: [0.1, 0.2, 0.3] },
    ]
    const out = bindingLinesHorizon(network, flows)
    expect(out).toHaveLength(1)
    expect(out[0]!.line_id).toBe(1)
    expect(out[0]!.binding_steps).toBe(1)
    expect(out[0]!.peak_utilization).toBeCloseTo(1.0)
  })
})

describe('objectiveDecomposition', () => {
  it('aggregates revenue rows by asset kind', () => {
    const revenue: RevenueBreakdown[] = [
      {
        asset_id: 'b1', asset_kind: 'battery',
        energy_revenue: 500, compute_revenue: 0, degradation_cost: 50,
        sla_penalty: 0, curtailment_penalty: 0, total: 450,
      },
      {
        asset_id: 'dc1', asset_kind: 'data_center',
        energy_revenue: 0, compute_revenue: 1000, degradation_cost: 0,
        sla_penalty: 20, curtailment_penalty: 0, total: 980,
      },
    ]
    const result: MultiPeriodSolution = {
      status: 'optimal', horizon_hours: 24, timestep_minutes: 60,
      n_timesteps: 24, timestamps: [], total_system_cost: 5000,
      solve_time_seconds: 0.1, generator_dispatch: [], line_flows: [],
      lmps: [], battery_trajectories: [], data_center_trajectories: [],
      renewable_trajectories: [], revenue, solver_stats: stats,
    }
    const d = objectiveDecomposition(result)
    expect(d.battery_energy_revenue).toBe(500)
    expect(d.battery_degradation).toBe(50)
    expect(d.data_center_compute_revenue).toBe(1000)
    expect(d.total).toBe(5000)
  })
})

describe('problemStats', () => {
  it('extracts solver diagnostics with sensible fallbacks', () => {
    const result = {
      status: 'optimal' as const,
      total_cost: 0, solve_time_seconds: 0.5,
      generator_output: {}, line_flow: {}, line_utilization: {},
      bus_lmp: {}, bus_load: {},
      solver_stats: stats,
    }
    expect(problemStats(result)).toEqual({
      solver: 'HIGHS',
      n_variables: 10,
      n_constraints: 20,
      status: 'optimal',
      solve_time_seconds: 0.5,
    })
  })
})
