import { beforeEach, describe, expect, it } from 'vitest'
import { useSimulator } from '../simulator'

const initialState = useSimulator.getState()

describe('useSimulator store', () => {
  beforeEach(() => {
    useSimulator.setState(initialState, true)
  })

  it('switches network and clears placed assets', () => {
    useSimulator.getState().addBattery({
      id: 'b1',
      bus: 5,
      e_max_mwh: 100,
      p_max_mw: 50,
      eta_c: 0.92,
      eta_d: 0.92,
      kappa: 2,
      initial_soc_mwh: 50,
    })
    expect(useSimulator.getState().batteries).toHaveLength(1)
    useSimulator.getState().setNetwork('ieee30')
    expect(useSimulator.getState().network).toBe('ieee30')
    expect(useSimulator.getState().batteries).toHaveLength(0)
  })

  it('updates a battery in place', () => {
    useSimulator.getState().addBattery({
      id: 'b1',
      bus: 5,
      e_max_mwh: 100,
      p_max_mw: 50,
      eta_c: 0.92,
      eta_d: 0.92,
      kappa: 2,
      initial_soc_mwh: 50,
    })
    useSimulator.getState().updateBattery('b1', { e_max_mwh: 200 })
    expect(useSimulator.getState().batteries[0]!.e_max_mwh).toBe(200)
  })

  it('removes assets', () => {
    useSimulator.getState().addRenewable({
      id: 'r1',
      bus: 3,
      kind: 'wind',
      capacity_mw: 100,
      curtailment_penalty_per_mwh: 0,
    })
    useSimulator.getState().removeRenewable('r1')
    expect(useSimulator.getState().renewables).toHaveLength(0)
  })

  it('loadScenario replaces all asset state', () => {
    useSimulator.getState().loadScenario({
      network: 'ieee14',
      horizon_hours: 12,
      timestep_minutes: 30,
      load_multiplier: 1.1,
      forecast: { source: 'xgboost' },
      batteries: [
        {
          id: 'b1',
          bus: 5,
          e_max_mwh: 100,
          p_max_mw: 50,
          eta_c: 0.92,
          eta_d: 0.92,
          kappa: 2,
          initial_soc_mwh: 50,
        },
      ],
      data_centers: [],
      renewables: [],
      scenarioId: 'test',
    })
    const s = useSimulator.getState()
    expect(s.horizonHours).toBe(12)
    expect(s.timestepMinutes).toBe(30)
    expect(s.batteries).toHaveLength(1)
    expect(s.scenarioId).toBe('test')
  })
})
