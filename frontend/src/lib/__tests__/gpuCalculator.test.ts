import { describe, it, expect } from 'vitest'
import {
  DEFAULT_INPUTS,
  GPU_MODELS,
  PRESETS,
  REGIONS,
  compute,
  effectiveRate,
  effectiveTdpWatts,
} from '../gpuCalculator'

describe('gpuCalculator', () => {
  it('default inputs produce sensible numbers', () => {
    const out = compute(DEFAULT_INPUTS)
    // 100K H100s @ 700 W * 80% util * 1.2 PUE -> 67.2 MW
    expect(out.total_power_kw).toBeCloseTo(67_200, 0)
    // 67.2 MW * 8760 hr -> ~588 GWh
    expect(out.annual_energy_kwh).toBeCloseTo(588_672_000, -3)
    // VA at 0.108 -> ~$63.6M
    expect(out.annual_cost_usd).toBeGreaterThan(63_000_000)
    expect(out.annual_cost_usd).toBeLessThan(64_000_000)
    // Per-GPU cost > $0
    expect(out.cost_per_gpu_yr).toBeGreaterThan(600)
  })

  it('solar PPA replaces the regional rate', () => {
    const ppa = compute({ ...DEFAULT_INPUTS, solar_ppa: true })
    const base = compute(DEFAULT_INPUTS)
    expect(ppa.annual_cost_usd).toBeLessThan(base.annual_cost_usd)
    expect(ppa.effective_rate_per_kwh).toBeCloseTo(0.057)
  })

  it('storage revenue reduces net cost', () => {
    const withStorage = compute({
      ...DEFAULT_INPUTS,
      storage: { enabled: true, capacity_mwh: 200, revenue_per_kw_yr: 35 },
    })
    expect(withStorage.storage_revenue_usd).toBeGreaterThan(0)
    expect(withStorage.net_cost_usd).toBeLessThan(withStorage.annual_cost_usd)
  })

  it('region ranking is sorted ascending by cost', () => {
    const out = compute(DEFAULT_INPUTS)
    for (let i = 1; i < out.ranking.length; i++) {
      expect(out.ranking[i]!.annual_cost_usd).toBeGreaterThanOrEqual(
        out.ranking[i - 1]!.annual_cost_usd,
      )
    }
  })

  it('every preset computes without throwing', () => {
    for (const preset of PRESETS) {
      const out = compute(preset.inputs)
      expect(out.annual_cost_usd).toBeGreaterThanOrEqual(0)
    }
  })

  it('every region has a positive rate and a citation', () => {
    for (const r of REGIONS) {
      expect(r.rate_per_kwh).toBeGreaterThan(0)
      expect(r.source.length).toBeGreaterThan(0)
    }
  })

  it('every GPU model has a positive TDP', () => {
    for (const m of GPU_MODELS) {
      expect(m.tdp_w).toBeGreaterThan(0)
    }
  })

  it('custom GPU TDP is honored', () => {
    expect(effectiveTdpWatts({ ...DEFAULT_INPUTS, gpu_model: 'custom', custom_tdp_w: 1500 }))
      .toBe(1500)
  })

  it('custom region rate is honored', () => {
    expect(
      effectiveRate({ ...DEFAULT_INPUTS, region: 'custom', custom_rate_per_kwh: 0.025 }),
    ).toBeCloseTo(0.025)
  })

  it('CO2 footprint scales with energy and grid carbon factor', () => {
    const va = compute({ ...DEFAULT_INPUTS, region: 'va' })
    const cn = compute({ ...DEFAULT_INPUTS, region: 'cn' })
    expect(cn.co2_tons_yr).toBeGreaterThan(va.co2_tons_yr)
  })

  it('homes_equivalent is positive for a non-trivial cluster', () => {
    const out = compute(DEFAULT_INPUTS)
    expect(out.homes_equivalent).toBeGreaterThan(10_000)
  })
})
