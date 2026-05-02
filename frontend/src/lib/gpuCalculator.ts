/** GPU cluster cost & siting calculator.
 *
 * Pure derivations: given a cluster spec (count, model, utilization, PUE),
 * a region (rate $/kWh, carbon factor), and optional storage / DR revenue
 * streams, compute annual electricity cost, energy throughput, CO2, and a
 * region-by-region comparison ranked by cost.
 *
 * All rates / carbon factors are public sources cited inline. */

export interface GPUModel {
  id: string
  name: string
  /** Thermal design power per GPU equivalent, watts */
  tdp_w: number
  /** Source citation, shown in the data-sources expander */
  source: string
}

export const GPU_MODELS: GPUModel[] = [
  {
    id: 'h100',
    name: 'NVIDIA H100 / H200',
    tdp_w: 700,
    source: 'NVIDIA H100 SXM datasheet',
  },
  {
    id: 'b200',
    name: 'NVIDIA B200',
    tdp_w: 1000,
    source: 'NVIDIA Blackwell B200 launch (GTC 2024)',
  },
  {
    id: 'gb200',
    name: 'NVIDIA GB200 NVL72 (per GPU equiv)',
    tdp_w: 1200,
    source: 'NVIDIA GB200 NVL72 spec sheet',
  },
  {
    id: 'a100',
    name: 'NVIDIA A100 (legacy)',
    tdp_w: 400,
    source: 'NVIDIA A100 SXM datasheet',
  },
  {
    id: 'mi300x',
    name: 'AMD MI300X',
    tdp_w: 750,
    source: 'AMD Instinct MI300X datasheet',
  },
  {
    id: 'custom',
    name: 'Custom (set TDP)',
    tdp_w: 700,
    source: 'User-supplied',
  },
]

export interface Region {
  id: string
  name: string
  /** Industrial retail rate, USD per kWh */
  rate_per_kwh: number
  /** Marginal CO2 intensity, grams CO2 per kWh */
  carbon_g_per_kwh: number
  source: string
  /** Free-form note shown in the comparison tooltip */
  note?: string
}

/** Default 12-region table. Numbers are 2024-25 industrial averages from
 * EIA Form 861 (US), Eurostat NRG_PC_205 (EU), and equivalent national
 * sources. Carbon intensities are 2024 IEA / NREL eGRID. */
export const REGIONS: Region[] = [
  {
    id: 'tx',
    name: 'Texas (US, ERCOT)',
    rate_per_kwh: 0.090,
    carbon_g_per_kwh: 410,
    source: 'EIA Form 861 (TX 2024) · NREL eGRID 2024',
    note: 'Lowest US grid rate at scale; gas + wind heavy.',
  },
  {
    id: 'va',
    name: 'Virginia (US, PJM AEP-DAYTON)',
    rate_per_kwh: 0.108,
    carbon_g_per_kwh: 380,
    source: 'PJM 2025-26 retail proxy · NREL eGRID',
    note: 'Matches the PJM data feeding the SDP simulator.',
  },
  {
    id: 'ca',
    name: 'California (US, CAISO)',
    rate_per_kwh: 0.180,
    carbon_g_per_kwh: 240,
    source: 'EIA Form 861 (CA 2024) · NREL eGRID 2024',
    note: 'High retail rate, low carbon (renewables-heavy).',
  },
  {
    id: 'wa',
    name: 'Washington (US, hydro)',
    rate_per_kwh: 0.078,
    carbon_g_per_kwh: 95,
    source: 'EIA Form 861 (WA 2024) · BPA load mix',
    note: 'Federal hydro keeps both rate and carbon low.',
  },
  {
    id: 'qc',
    name: 'Quebec (Canada, hydro)',
    rate_per_kwh: 0.072,
    carbon_g_per_kwh: 30,
    source: 'Hydro-Québec rate L (industrial) · IEA',
    note: 'Quasi-zero-carbon hydro at sub-US-average rates.',
  },
  {
    id: 'is',
    name: 'Iceland (geothermal)',
    rate_per_kwh: 0.085,
    carbon_g_per_kwh: 27,
    source: 'Landsvirkjun industrial rate · Orkustofnun',
  },
  {
    id: 'nordic',
    name: 'Nordic (Sweden / Norway)',
    rate_per_kwh: 0.095,
    carbon_g_per_kwh: 50,
    source: 'Eurostat NRG_PC_205 (SE/NO 2024) · IEA',
  },
  {
    id: 'de',
    name: 'Germany',
    rate_per_kwh: 0.233,
    carbon_g_per_kwh: 380,
    source: 'Eurostat NRG_PC_205 (DE 2024) · UBA',
    note: 'Highest in this table; phasing out nuclear and lignite.',
  },
  {
    id: 'fr',
    name: 'France (nuclear-heavy)',
    rate_per_kwh: 0.165,
    carbon_g_per_kwh: 60,
    source: 'Eurostat NRG_PC_205 (FR 2024) · RTE',
  },
  {
    id: 'cn',
    name: 'China (Inland)',
    rate_per_kwh: 0.070,
    carbon_g_per_kwh: 580,
    source: 'NDRC industrial tariff · IEA',
    note: 'Cheapest in this table; coal-heavy.',
  },
  {
    id: 'sa',
    name: 'Saudi Arabia',
    rate_per_kwh: 0.048,
    carbon_g_per_kwh: 620,
    source: 'SEC industrial tariff (2024) · IEA',
    note: 'Very cheap; gas / oil generation mix.',
  },
  {
    id: 'custom',
    name: 'Custom (set rate)',
    rate_per_kwh: 0.10,
    carbon_g_per_kwh: 400,
    source: 'User-supplied',
  },
]

const SOLAR_PPA_RATE = 0.057

export interface CalculatorInputs {
  num_gpus: number
  gpu_model: string
  custom_tdp_w?: number
  utilization: number
  pue: number
  region: string
  custom_rate_per_kwh?: number
  solar_ppa: boolean
  storage: { enabled: boolean; capacity_mwh: number; revenue_per_kw_yr: number }
  demand_response: { enabled: boolean; revenue_per_kw_yr: number }
}

export const DEFAULT_INPUTS: CalculatorInputs = {
  num_gpus: 100_000,
  gpu_model: 'h100',
  utilization: 0.80,
  pue: 1.20,
  region: 'va',
  solar_ppa: false,
  storage: { enabled: false, capacity_mwh: 200, revenue_per_kw_yr: 35 },
  demand_response: { enabled: false, revenue_per_kw_yr: 8 },
}

export interface RegionRanking {
  region: Region
  /** Annual cost USD if this cluster were sited here */
  annual_cost_usd: number
  /** Delta vs the user's currently selected region (USD/yr) */
  delta_usd: number
  /** Same delta as a percentage of the user's selected region's cost */
  delta_pct: number
}

export interface CalculatorOutputs {
  total_power_kw: number
  annual_energy_kwh: number
  annual_energy_twh: number
  annual_cost_usd: number
  monthly_cost_usd: number
  cost_per_gpu_yr: number
  co2_tons_yr: number
  homes_equivalent: number
  storage_revenue_usd: number
  dr_revenue_usd: number
  net_cost_usd: number
  effective_rate_per_kwh: number
  ranking: RegionRanking[]
}

const HOURS_PER_YEAR = 24 * 365
/** US average household consumption, kWh/yr (EIA RECS 2020) */
const HOUSEHOLD_KWH_YR = 10_500

function lookupModel(id: string): GPUModel | undefined {
  return GPU_MODELS.find((m) => m.id === id)
}

function lookupRegion(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id)
}

export function effectiveTdpWatts(inputs: CalculatorInputs): number {
  if (inputs.gpu_model === 'custom') {
    return Math.max(50, inputs.custom_tdp_w ?? 700)
  }
  return lookupModel(inputs.gpu_model)?.tdp_w ?? 700
}

export function effectiveRate(inputs: CalculatorInputs): number {
  if (inputs.solar_ppa) return SOLAR_PPA_RATE
  if (inputs.region === 'custom') return inputs.custom_rate_per_kwh ?? 0.1
  return lookupRegion(inputs.region)?.rate_per_kwh ?? 0.1
}

export function compute(inputs: CalculatorInputs): CalculatorOutputs {
  const tdp_w = effectiveTdpWatts(inputs)
  const u = Math.max(0, Math.min(1, inputs.utilization))
  const pue = Math.max(1.0, inputs.pue)

  // Total IT load × PUE = total facility load
  const it_load_kw = (tdp_w / 1000) * inputs.num_gpus * u
  const total_power_kw = it_load_kw * pue

  const annual_energy_kwh = total_power_kw * HOURS_PER_YEAR
  const annual_energy_twh = annual_energy_kwh / 1e9

  const region = lookupRegion(inputs.region)
  const rate = effectiveRate(inputs)
  const annual_cost_usd = annual_energy_kwh * rate

  const carbon_g = region?.carbon_g_per_kwh ?? 400
  // Solar PPA effectively zeroes Scope 2 emissions for the contracted volume;
  // we keep the regional grid carbon as a conservative gross-Scope-2 figure
  // unless the user is on a PPA, in which case we cut it by 90%.
  const effective_carbon = inputs.solar_ppa ? carbon_g * 0.10 : carbon_g
  const co2_tons_yr = (annual_energy_kwh * effective_carbon) / 1e6 // g -> tonnes

  // Storage revenue: assume the battery participates in PJM-style reg market
  // at the user's stated $/kW-yr. Capacity in MWh × 4-hour duration -> kW.
  const storage_revenue_usd = inputs.storage.enabled
    ? (inputs.storage.capacity_mwh * 1000 / 4) * inputs.storage.revenue_per_kw_yr
    : 0

  // Demand response: applies to the cluster's full power draw at the stated
  // $/kW-yr. Realistic PJM ELRP / curtailable-load programs.
  const dr_revenue_usd = inputs.demand_response.enabled
    ? total_power_kw * inputs.demand_response.revenue_per_kw_yr
    : 0

  const net_cost_usd = annual_cost_usd - storage_revenue_usd - dr_revenue_usd

  // Region comparison ranking
  const ranking: RegionRanking[] = REGIONS.filter((r) => r.id !== 'custom').map((r) => {
    const rate_r = r.rate_per_kwh
    const cost = annual_energy_kwh * rate_r
    const delta = cost - annual_cost_usd
    const delta_pct = annual_cost_usd > 0 ? (delta / annual_cost_usd) * 100 : 0
    return { region: r, annual_cost_usd: cost, delta_usd: delta, delta_pct }
  }).sort((a, b) => a.annual_cost_usd - b.annual_cost_usd)

  return {
    total_power_kw,
    annual_energy_kwh,
    annual_energy_twh,
    annual_cost_usd,
    monthly_cost_usd: annual_cost_usd / 12,
    cost_per_gpu_yr: inputs.num_gpus > 0 ? annual_cost_usd / inputs.num_gpus : 0,
    co2_tons_yr,
    homes_equivalent: annual_energy_kwh / HOUSEHOLD_KWH_YR,
    storage_revenue_usd,
    dr_revenue_usd,
    net_cost_usd,
    effective_rate_per_kwh: rate,
    ranking,
  }
}

export interface CalculatorPreset {
  id: string
  label: string
  description: string
  inputs: CalculatorInputs
}

export const PRESETS: CalculatorPreset[] = [
  {
    id: 'stargate',
    label: 'OpenAI Stargate',
    description: '1M H100s in Texas at 80% utilization.',
    inputs: {
      ...DEFAULT_INPUTS,
      num_gpus: 1_000_000,
      gpu_model: 'h100',
      utilization: 0.80,
      pue: 1.20,
      region: 'tx',
    },
  },
  {
    id: 'colossus',
    label: 'xAI Colossus',
    description: '200K H100s in Tennessee (TVA mix), 90% utilization.',
    inputs: {
      ...DEFAULT_INPUTS,
      num_gpus: 200_000,
      gpu_model: 'h100',
      utilization: 0.90,
      pue: 1.25,
      region: 'va', // TVA isn't in our 12-region list; VA is the closest PJM proxy
    },
  },
  {
    id: 'anthropic',
    label: 'Anthropic Cluster',
    description: '100K H100s in US Pacific Northwest hydro.',
    inputs: {
      ...DEFAULT_INPUTS,
      num_gpus: 100_000,
      gpu_model: 'h100',
      utilization: 0.75,
      pue: 1.15,
      region: 'wa',
    },
  },
  {
    id: 'gemini',
    label: 'DeepMind / Gemini',
    description: '50K B200s in Iowa-equivalent (US wind heavy).',
    inputs: {
      ...DEFAULT_INPUTS,
      num_gpus: 50_000,
      gpu_model: 'b200',
      utilization: 0.85,
      pue: 1.20,
      region: 'tx',
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Reset to defaults and configure freely.',
    inputs: DEFAULT_INPUTS,
  },
]
