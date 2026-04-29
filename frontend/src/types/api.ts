/** TypeScript mirror of the backend Pydantic schemas in `backend/app/schemas/`.
 *
 * Kept hand-written (rather than auto-generated from OpenAPI) so we can put
 * stricter narrow types and friendly aliases on top.  Fields must match the
 * backend exactly — when changing a schema, update both sides in the same PR.
 */

export type NetworkName = 'bus5' | 'ieee14' | 'ieee30'
export type FuelType =
  | 'coal'
  | 'gas'
  | 'nuclear'
  | 'hydro'
  | 'wind'
  | 'solar'
  | 'oil'

export interface Bus {
  id: number
  name: string
  base_kv: number
  x: number
  y: number
  is_slack: boolean
}

export interface Line {
  id: number
  from_bus: number
  to_bus: number
  name: string
  reactance: number
  capacity_mva: number
}

export interface Generator {
  id: number
  bus: number
  name: string
  fuel: FuelType
  capacity_mw: number
  cost_per_mwh: number
  ramp_rate_mw_per_min: number
  min_output_mw: number
}

export interface Load {
  bus: number
  peak_mw: number
  profile_type: 'residential' | 'commercial' | 'industrial' | 'flat'
}

export interface NetworkData {
  name: NetworkName
  display_name: string
  base_mva: number
  buses: Bus[]
  lines: Line[]
  generators: Generator[]
  loads: Load[]
}

export interface NetworkSummary {
  name: NetworkName
  display_name: string
  n_buses: number
  n_lines: number
  n_generators: number
  description: string
}

export type ForecastSource = 'perfect' | 'naive' | 'xgboost' | 'custom'

export interface BatteryAsset {
  id: string
  bus: number
  e_max_mwh: number
  p_max_mw: number
  eta_c: number
  eta_d: number
  kappa: number
  initial_soc_mwh: number
}

export interface DataCenterAsset {
  id: string
  bus: number
  c_max_mw: number
  compute_value_per_mwh: number
  flex_min: number
  flex_max: number
  sla_penalty_per_mwh: number
}

export interface RenewableAsset {
  id: string
  bus: number
  kind: 'solar' | 'wind'
  capacity_mw: number
  curtailment_penalty_per_mwh: number
}

export interface ForecastSpec {
  source: ForecastSource
  seed?: number | null
  custom_csv?: string | null
}

export interface MultiPeriodRequest {
  network: NetworkName
  horizon_hours: number
  timestep_minutes: number
  load_multiplier: number
  batteries: BatteryAsset[]
  data_centers: DataCenterAsset[]
  renewables: RenewableAsset[]
  forecast: ForecastSpec
}

export interface GenDispatchPoint {
  gen_id: number
  p_mw: number[]
}

export interface LineFlowPoint {
  line_id: number
  flow_mw: number[]
  utilization: number[]
}

export interface LMPPoint {
  bus: number
  lmp_per_mwh: number[]
}

export interface BatteryTrajectory {
  asset_id: string
  soc_mwh: number[]
  charge_mw: number[]
  discharge_mw: number[]
}

export interface DataCenterTrajectory {
  asset_id: string
  utilization: number[]
  consumption_mw: number[]
}

export interface RenewableTrajectory {
  asset_id: string
  available_mw: number[]
  delivered_mw: number[]
  curtailment_mw: number[]
}

export interface RevenueBreakdown {
  asset_id: string
  asset_kind: 'battery' | 'data_center' | 'renewable'
  energy_revenue: number
  compute_revenue: number
  degradation_cost: number
  sla_penalty: number
  curtailment_penalty: number
  total: number
}

export type SolveStatus = 'optimal' | 'optimal_inaccurate' | 'infeasible'

export interface MultiPeriodSolution {
  status: SolveStatus
  horizon_hours: number
  timestep_minutes: number
  n_timesteps: number
  timestamps: string[]
  total_system_cost: number
  solve_time_seconds: number
  generator_dispatch: GenDispatchPoint[]
  line_flows: LineFlowPoint[]
  lmps: LMPPoint[]
  battery_trajectories: BatteryTrajectory[]
  data_center_trajectories: DataCenterTrajectory[]
  renewable_trajectories: RenewableTrajectory[]
  revenue: RevenueBreakdown[]
}

export interface SinglePeriodRequest {
  network: NetworkName
  load_multiplier: number
  wind_availability: number
  line_capacity_overrides: Record<number, number>
}

export interface SinglePeriodSolution {
  status: SolveStatus
  total_cost: number
  solve_time_seconds: number
  generator_output: Record<number, number>
  line_flow: Record<number, number>
  line_utilization: Record<number, number>
  bus_lmp: Record<number, number>
  bus_load: Record<number, number>
}

export interface ScenarioSummary {
  id: string
  title: string
  short_description: string
  network: string
  tags: string[]
}

export interface Scenario {
  id: string
  title: string
  short_description: string
  long_description: string
  key_insight: string
  network: string
  tags: string[]
  config: MultiPeriodRequest
}

// SDP comparison
export type PolicyName = 'perfect_foresight' | 'myopic_greedy' | 'mpc'

export interface PolicyResult {
  policy_name: PolicyName
  total_revenue: number
  energy_revenue: number
  regulation_revenue: number
  degradation_cost: number
  solve_time_seconds: number
  schedule_charge_mw: number[]
  schedule_discharge_mw: number[]
  schedule_soc_mwh: number[]
  schedule_lmp: number[]
}

export interface SDPResponse {
  timestamps: string[]
  policies: PolicyResult[]
}

// WebSocket events
export type WsEvent =
  | { event: 'started'; ts?: number }
  | { event: 'heartbeat'; elapsed: number; phase: string }
  | { event: 'completed'; elapsed: number; result: MultiPeriodSolution }
  | { event: 'failed'; error: string | unknown }
