/** Zustand store for the Pro simulator.
 *
 * Holds:
 *   - selected network and mode (live | optimization)
 *   - asset placement (batteries, data centers, renewables)
 *   - placement-mode flag for the click-to-place UI
 *   - horizon / timestep / forecast controls
 *   - the last solve result (multi-period or single-period)
 *   - the time scrubber position
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  BatteryAsset,
  DataCenterAsset,
  ForecastSource,
  MultiPeriodSolution,
  NetworkName,
  RenewableAsset,
  SinglePeriodSolution,
} from '@/types/api'

export type SimulatorMode = 'live' | 'optimization'
export type AssetKind = 'battery' | 'data_center' | 'renewable' | null

export interface SimulatorState {
  network: NetworkName
  mode: SimulatorMode
  scenarioId: string | null

  // Live mode controls
  loadMultiplier: number
  windAvailability: number

  // Optimization mode controls
  horizonHours: number
  timestepMinutes: number
  forecastSource: ForecastSource

  // Placed assets
  batteries: BatteryAsset[]
  dataCenters: DataCenterAsset[]
  renewables: RenewableAsset[]

  // Placement UX
  placementMode: AssetKind
  selectedBus: number | null

  // Solve results
  multiResult: MultiPeriodSolution | null
  liveResult: SinglePeriodSolution | null
  liveLoading: boolean
  liveError: string | null
  isSolving: boolean
  solveError: string | null
  solveElapsed: number | null

  // Scrubber
  scrubberStep: number
  isPlaying: boolean

  // Actions
  setNetwork: (n: NetworkName) => void
  setMode: (m: SimulatorMode) => void
  setLoadMultiplier: (v: number) => void
  setWindAvailability: (v: number) => void
  setHorizonHours: (v: number) => void
  setTimestepMinutes: (v: number) => void
  setForecastSource: (s: ForecastSource) => void
  setPlacementMode: (k: AssetKind) => void
  setSelectedBus: (b: number | null) => void
  addBattery: (b: BatteryAsset) => void
  updateBattery: (id: string, patch: Partial<BatteryAsset>) => void
  removeBattery: (id: string) => void
  addDataCenter: (d: DataCenterAsset) => void
  updateDataCenter: (id: string, patch: Partial<DataCenterAsset>) => void
  removeDataCenter: (id: string) => void
  addRenewable: (r: RenewableAsset) => void
  updateRenewable: (id: string, patch: Partial<RenewableAsset>) => void
  removeRenewable: (id: string) => void
  clearAssets: () => void
  setMultiResult: (r: MultiPeriodSolution | null) => void
  setLiveResult: (r: SinglePeriodSolution | null) => void
  setLiveLoading: (b: boolean) => void
  setLiveError: (s: string | null) => void
  setSolving: (b: boolean) => void
  setSolveError: (s: string | null) => void
  setSolveElapsed: (s: number | null) => void
  setScrubberStep: (s: number) => void
  setPlaying: (b: boolean) => void
  setScenario: (id: string | null) => void
  loadScenario: (cfg: {
    network: NetworkName
    horizon_hours: number
    timestep_minutes: number
    load_multiplier: number
    forecast: { source: ForecastSource }
    batteries: BatteryAsset[]
    data_centers: DataCenterAsset[]
    renewables: RenewableAsset[]
    scenarioId: string
  }) => void
}

export const useSimulator = create<SimulatorState>()(
  subscribeWithSelector((set) => ({
    network: 'ieee14',
    mode: 'optimization',
    scenarioId: null,
    loadMultiplier: 1.0,
    windAvailability: 1.0,
    horizonHours: 24,
    timestepMinutes: 60,
    forecastSource: 'perfect',
    batteries: [],
    dataCenters: [],
    renewables: [],
    placementMode: null,
    selectedBus: null,
    multiResult: null,
    liveResult: null,
    liveLoading: false,
    liveError: null,
    isSolving: false,
    solveError: null,
    solveElapsed: null,
    scrubberStep: 0,
    isPlaying: false,

    setNetwork: (n) =>
      set({
        network: n,
        // Clear assets — bus IDs differ across networks
        batteries: [],
        dataCenters: [],
        renewables: [],
        multiResult: null,
        liveResult: null,
        scrubberStep: 0,
        scenarioId: null,
      }),
    setMode: (m) => set({ mode: m }),
    setLoadMultiplier: (v) => set({ loadMultiplier: v }),
    setWindAvailability: (v) => set({ windAvailability: v }),
    setHorizonHours: (v) => set({ horizonHours: v, scrubberStep: 0 }),
    setTimestepMinutes: (v) => set({ timestepMinutes: v, scrubberStep: 0 }),
    setForecastSource: (s) => set({ forecastSource: s }),
    setPlacementMode: (k) => set({ placementMode: k }),
    setSelectedBus: (b) => set({ selectedBus: b }),

    addBattery: (b) => set((s) => ({ batteries: [...s.batteries, b] })),
    updateBattery: (id, patch) =>
      set((s) => ({
        batteries: s.batteries.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      })),
    removeBattery: (id) =>
      set((s) => ({ batteries: s.batteries.filter((b) => b.id !== id) })),

    addDataCenter: (d) => set((s) => ({ dataCenters: [...s.dataCenters, d] })),
    updateDataCenter: (id, patch) =>
      set((s) => ({
        dataCenters: s.dataCenters.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      })),
    removeDataCenter: (id) =>
      set((s) => ({ dataCenters: s.dataCenters.filter((d) => d.id !== id) })),

    addRenewable: (r) => set((s) => ({ renewables: [...s.renewables, r] })),
    updateRenewable: (id, patch) =>
      set((s) => ({
        renewables: s.renewables.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),
    removeRenewable: (id) =>
      set((s) => ({ renewables: s.renewables.filter((r) => r.id !== id) })),

    clearAssets: () => set({ batteries: [], dataCenters: [], renewables: [] }),
    setMultiResult: (r) => set({ multiResult: r }),
    setLiveResult: (r) => set({ liveResult: r }),
    setLiveLoading: (b) => set({ liveLoading: b }),
    setLiveError: (s) => set({ liveError: s }),
    setSolving: (b) => set({ isSolving: b }),
    setSolveError: (s) => set({ solveError: s }),
    setSolveElapsed: (s) => set({ solveElapsed: s }),
    setScrubberStep: (s) => set({ scrubberStep: s }),
    setPlaying: (b) => set({ isPlaying: b }),
    setScenario: (id) => set({ scenarioId: id }),

    loadScenario: (cfg) =>
      set({
        network: cfg.network,
        horizonHours: cfg.horizon_hours,
        timestepMinutes: cfg.timestep_minutes,
        loadMultiplier: cfg.load_multiplier,
        forecastSource: cfg.forecast.source,
        batteries: cfg.batteries,
        dataCenters: cfg.data_centers,
        renewables: cfg.renewables,
        scenarioId: cfg.scenarioId,
        multiResult: null,
        liveResult: null,
        scrubberStep: 0,
        placementMode: null,
        selectedBus: null,
      }),
  })),
)
