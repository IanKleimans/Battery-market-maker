import { beforeEach, describe, expect, it } from 'vitest'
import { deleteScenario, listScenarios, renameScenario, saveScenario } from '../livescenarios'
import { EMPTY_LIVE_OVERRIDES } from '@/store/simulator'

describe('livescenarios', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('save then list returns the saved scenario', () => {
    const s = saveScenario({
      name: 'Test',
      network: 'ieee14',
      load_multiplier: 1.2,
      wind_availability: 0.6,
      overrides: EMPTY_LIVE_OVERRIDES,
    })
    expect(s.id).toMatch(/^live-/)
    const all = listScenarios()
    expect(all).toHaveLength(1)
    expect(all[0]!.name).toBe('Test')
  })

  it('list returns most-recent first', () => {
    saveScenario({
      name: 'A',
      network: 'ieee14',
      load_multiplier: 1.0,
      wind_availability: 1.0,
      overrides: EMPTY_LIVE_OVERRIDES,
    })
    saveScenario({
      name: 'B',
      network: 'ieee14',
      load_multiplier: 1.0,
      wind_availability: 1.0,
      overrides: EMPTY_LIVE_OVERRIDES,
    })
    const names = listScenarios().map((x) => x.name)
    expect(names).toEqual(['B', 'A'])
  })

  it('rename and delete behave as expected', () => {
    const s = saveScenario({
      name: 'A',
      network: 'ieee14',
      load_multiplier: 1.0,
      wind_availability: 1.0,
      overrides: EMPTY_LIVE_OVERRIDES,
    })
    renameScenario(s.id, 'A1')
    expect(listScenarios()[0]!.name).toBe('A1')
    deleteScenario(s.id)
    expect(listScenarios()).toHaveLength(0)
  })

  it('survives a corrupt localStorage entry without throwing', () => {
    localStorage.setItem('bmm.live-scenarios.v1', 'not json')
    expect(listScenarios()).toEqual([])
  })
})
