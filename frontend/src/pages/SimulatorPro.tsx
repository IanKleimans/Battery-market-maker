/** The Pro simulator — IEEE 14-bus / 30-bus / 5-bus with Live and Optimization modes. */

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { Wand2, Sparkles, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { useSimulator } from '@/store/simulator'
import { useSolveSimulator } from '@/hooks/useSolveSimulator'
import { useFrameState } from '@/hooks/useFrameState'
import { useLiveDispatch } from '@/hooks/useLiveDispatch'
import { useLiveFrame } from '@/hooks/useLiveFrame'
import {
  Badge,
  Button,
  Card,
  Select,
  Skeleton,
  Slider,
  toast,
} from '@/components/ui'
import {
  AssetPanel,
  NetworkDiagram,
  TimeScrubber,
  ResultsPanel,
} from '@/components/network'
import type {
  BatteryAsset,
  DataCenterAsset,
  ForecastSource,
  NetworkName,
  RenewableAsset,
} from '@/types/api'

// ---------- top bar ----------

function TopBar() {
  const network = useSimulator((s) => s.network)
  const setNetwork = useSimulator((s) => s.setNetwork)
  const mode = useSimulator((s) => s.mode)
  const setMode = useSimulator((s) => s.setMode)
  const scenarioId = useSimulator((s) => s.scenarioId)
  const loadScenario = useSimulator((s) => s.loadScenario)

  const { data: scenarios } = useQuery({
    queryKey: ['scenarios'],
    queryFn: api.listScenarios,
  })

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface/40">
      <Select
        value={network}
        onValueChange={(v) => setNetwork(v as NetworkName)}
        size="sm"
        options={[
          { value: 'bus5', label: '5-Bus Classic' },
          { value: 'ieee14', label: 'IEEE 14-Bus' },
          { value: 'ieee30', label: 'IEEE 30-Bus' },
        ]}
      />
      <div className="inline-flex items-center gap-1 p-1 rounded bg-surface border border-border">
        {(['live', 'optimization'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`h-7 px-3 text-xs rounded font-medium transition-colors capitalize ${
              mode === m
                ? 'bg-accent text-white'
                : 'text-text-2 hover:text-text-1'
            }`}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <Select
        value={scenarioId ?? '_none'}
        onValueChange={(v) => {
          if (v === '_none') return
          const s = scenarios?.find((x) => x.id === v)
          if (!s) return
          api.getScenario(s.id).then((full) => {
            loadScenario({
              network: full.config.network,
              horizon_hours: full.config.horizon_hours,
              timestep_minutes: full.config.timestep_minutes,
              load_multiplier: full.config.load_multiplier,
              forecast: full.config.forecast,
              batteries: full.config.batteries,
              data_centers: full.config.data_centers,
              renewables: full.config.renewables,
              scenarioId: full.id,
            })
            toast('info', { title: full.title, description: full.key_insight })
          })
        }}
        size="sm"
        options={[
          { value: '_none', label: 'Pick scenario…' },
          ...(scenarios ?? []).map((s) => ({
            value: s.id,
            label: s.title,
            description: s.short_description,
          })),
        ]}
      />

      <Badge tone="warning">SYNTHETIC</Badge>
    </div>
  )
}

// ---------- mode wrappers ----------

function LiveMode() {
  const network = useSimulator((s) => s.network)
  const loadMul = useSimulator((s) => s.loadMultiplier)
  const wind = useSimulator((s) => s.windAvailability)
  const setLoadMul = useSimulator((s) => s.setLoadMultiplier)
  const setWind = useSimulator((s) => s.setWindAvailability)
  const setSelectedBus = useSimulator((s) => s.setSelectedBus)
  const selectedBus = useSimulator((s) => s.selectedBus)
  const live = useSimulator((s) => s.liveResult)

  const { data: net } = useQuery({
    queryKey: ['network', network],
    queryFn: () => api.getNetwork(network),
  })

  useLiveDispatch(true)
  const frame = useLiveFrame(live)

  const hasWind = useMemo(
    () => net?.generators.some((g) => g.fuel === 'wind') ?? false,
    [net],
  )

  if (!net) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="h-64 w-3/4 max-w-2xl" />
      </div>
    )
  }

  return (
    <div className="flex-1 grid grid-cols-[280px_1fr] min-h-0">
      <aside className="border-r border-border bg-surface/40 p-3 space-y-3 overflow-y-auto">
        <Card className="p-3">
          <h4 className="text-xs font-semibold text-text-1 mb-2">Live controls</h4>
          <Slider
            label="Load multiplier"
            value={loadMul}
            min={0.3}
            max={1.6}
            step={0.05}
            onChange={setLoadMul}
            format={(v) => `${(v * 100).toFixed(0)}%`}
          />
          {hasWind && (
            <Slider
              label="Wind availability"
              value={wind}
              min={0}
              max={1}
              step={0.05}
              onChange={setWind}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />
          )}
          {live && (
            <div className="mt-3 text-[11px] mono text-text-2 space-y-0.5">
              <div>
                Total cost{' '}
                <span className="text-text-1">${live.total_cost.toFixed(0)}/h</span>
              </div>
              <div>
                Solver{' '}
                <span className="text-text-1">
                  {(live.solve_time_seconds * 1000).toFixed(0)} ms
                </span>
              </div>
            </div>
          )}
        </Card>

        {selectedBus !== null && (
          <Card className="p-3 animate-fade-in">
            <h4 className="text-xs font-semibold text-text-1 mb-1">Bus {selectedBus}</h4>
            {frame && (
              <div className="text-[11px] mono text-text-2 space-y-0.5">
                <div>
                  LMP{' '}
                  <span className="text-text-1">
                    ${(frame.busLMP[selectedBus] ?? 0).toFixed(2)}/MWh
                  </span>
                </div>
                <div>
                  Load{' '}
                  <span className="text-text-1">
                    {(frame.busLoad[selectedBus] ?? 0).toFixed(1)} MW
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}
      </aside>

      <section className="relative bg-bg flex items-stretch min-h-0">
        <NetworkDiagram
          network={net}
          frame={frame}
          selectedBus={selectedBus}
          onBusClick={(b) => setSelectedBus(b === selectedBus ? null : b)}
          baseline={!frame}
          width="100%"
          height="100%"
        />
      </section>
    </div>
  )
}

function OptimizationMode() {
  const network = useSimulator((s) => s.network)
  const horizon = useSimulator((s) => s.horizonHours)
  const timestep = useSimulator((s) => s.timestepMinutes)
  const forecast = useSimulator((s) => s.forecastSource)
  const setHorizon = useSimulator((s) => s.setHorizonHours)
  const setTimestep = useSimulator((s) => s.setTimestepMinutes)
  const setForecast = useSimulator((s) => s.setForecastSource)
  const placement = useSimulator((s) => s.placementMode)
  const setPlacement = useSimulator((s) => s.setPlacementMode)
  const batteries = useSimulator((s) => s.batteries)
  const dataCenters = useSimulator((s) => s.dataCenters)
  const renewables = useSimulator((s) => s.renewables)
  const addBattery = useSimulator((s) => s.addBattery)
  const addDC = useSimulator((s) => s.addDataCenter)
  const addRen = useSimulator((s) => s.addRenewable)
  const setSelectedBus = useSimulator((s) => s.setSelectedBus)
  const isSolving = useSimulator((s) => s.isSolving)
  const solveError = useSimulator((s) => s.solveError)
  const solveElapsed = useSimulator((s) => s.solveElapsed)
  const result = useSimulator((s) => s.multiResult)

  const { data: net } = useQuery({
    queryKey: ['network', network],
    queryFn: () => api.getNetwork(network),
  })

  const frame = useFrameState(result, net ?? null)
  const { solve } = useSolveSimulator()

  const handleBusClick = (busId: number) => {
    if (!placement) {
      setSelectedBus(busId)
      return
    }
    if (placement === 'battery') {
      addBattery(makeBattery(busId, batteries.length))
    } else if (placement === 'data_center') {
      addDC(makeDC(busId, dataCenters.length))
    } else if (placement === 'renewable') {
      addRen(makeRenewable(busId, renewables.length))
    }
    setPlacement(null)
  }

  if (!net) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="h-64 w-3/4 max-w-2xl" />
      </div>
    )
  }

  return (
    <div className="flex-1 grid grid-cols-[300px_1fr_360px] grid-rows-[1fr_auto] min-h-0">
      {/* Left: assets + controls */}
      <aside className="row-span-1 border-r border-border bg-surface/40 p-3 flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <AssetPanel />
        </div>
        <div className="border-t border-border pt-3 space-y-3">
          <Select
            value={forecast}
            onValueChange={(v) => setForecast(v as ForecastSource)}
            size="sm"
            options={[
              { value: 'perfect', label: 'Perfect Foresight' },
              { value: 'xgboost', label: 'XGBoost forecast' },
              { value: 'naive', label: 'Naive persistence' },
            ]}
          />
          <Select
            value={String(horizon)}
            onValueChange={(v) => setHorizon(Number(v))}
            size="sm"
            options={[
              { value: '6', label: '6 h horizon' },
              { value: '12', label: '12 h horizon' },
              { value: '24', label: '24 h horizon' },
              { value: '48', label: '48 h horizon' },
            ]}
          />
          <Select
            value={String(timestep)}
            onValueChange={(v) => setTimestep(Number(v))}
            size="sm"
            options={[
              { value: '60', label: '1 hr step' },
              { value: '30', label: '30 min step' },
              { value: '15', label: '15 min step' },
            ]}
          />
          <Button
            size="lg"
            className="w-full"
            onClick={solve}
            loading={isSolving}
            disabled={isSolving}
          >
            <Wand2 size={16} /> Optimize
          </Button>
          {solveError && (
            <p className="text-[11px] text-danger mono">{solveError}</p>
          )}
          {solveElapsed !== null && !isSolving && !solveError && (
            <p className="text-[11px] text-text-2 mono">
              Solved in {solveElapsed.toFixed(2)} s
            </p>
          )}
        </div>
      </aside>

      {/* Center: network diagram */}
      <section className="relative bg-bg flex items-stretch min-h-0 row-span-1">
        <NetworkDiagram
          network={net}
          frame={frame}
          batteries={batteries}
          dataCenters={dataCenters}
          renewables={renewables}
          placementMode={placement}
          onBusClick={handleBusClick}
          baseline={!frame}
          width="100%"
          height="100%"
        />
        <AnimatePresence>
          {isSolving && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-sm"
            >
              <Card className="text-center px-8 py-6">
                <Loader2 className="text-accent animate-spin mx-auto mb-2" />
                <div className="text-sm font-semibold text-text-1">Solving</div>
                <div className="text-xs text-text-2 mt-1 mono">
                  {solveElapsed !== null ? `${solveElapsed.toFixed(1)} s elapsed` : 'building LP…'}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Right: results */}
      <aside className="row-span-1 border-l border-border bg-surface/40 p-3 min-h-0 overflow-hidden">
        {result ? (
          <ResultsPanel result={result} network={net} />
        ) : (
          <Card className="text-xs text-text-2 leading-relaxed">
            <Sparkles className="text-accent mb-2" size={16} />
            Place a battery, data center, or renewable on the network, then click{' '}
            <span className="mono text-text-1">Optimize</span> to solve a 24-hour
            DC-OPF. Results — dispatch, SOC, LMPs, revenue — appear here.
          </Card>
        )}
      </aside>

      {/* Bottom: scrubber spans all 3 columns when result exists */}
      <div className="col-span-3">
        {result && <TimeScrubber result={result} />}
      </div>
    </div>
  )
}

// ---------- defaults for placement ----------

function makeBattery(bus: number, idx: number): BatteryAsset {
  return {
    id: `bess-${idx + 1}-bus${bus}`,
    bus,
    e_max_mwh: 100,
    p_max_mw: 50,
    eta_c: 0.92,
    eta_d: 0.92,
    kappa: 2.0,
    initial_soc_mwh: 50,
  }
}

function makeDC(bus: number, idx: number): DataCenterAsset {
  return {
    id: `dc-${idx + 1}-bus${bus}`,
    bus,
    c_max_mw: 200,
    compute_value_per_mwh: 100,
    flex_min: 0.4,
    flex_max: 1.0,
    sla_penalty_per_mwh: 15,
  }
}

function makeRenewable(bus: number, idx: number): RenewableAsset {
  return {
    id: `ren-${idx + 1}-bus${bus}`,
    bus,
    kind: 'wind',
    capacity_mw: 100,
    curtailment_penalty_per_mwh: 0,
  }
}

// ---------- page ----------

export function SimulatorPro() {
  const mode = useSimulator((s) => s.mode)
  const [params] = useSearchParams()
  const loadScenario = useSimulator((s) => s.loadScenario)

  // Load scenario from URL ?scenario=…
  useEffect(() => {
    const id = params.get('scenario')
    if (!id) return
    api.getScenario(id).then((full) => {
      loadScenario({
        network: full.config.network,
        horizon_hours: full.config.horizon_hours,
        timestep_minutes: full.config.timestep_minutes,
        load_multiplier: full.config.load_multiplier,
        forecast: full.config.forecast,
        batteries: full.config.batteries,
        data_centers: full.config.data_centers,
        renewables: full.config.renewables,
        scenarioId: full.id,
      })
      toast('info', { title: full.title, description: full.key_insight })
    })
  }, [params, loadScenario])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar />
      {mode === 'live' ? <LiveMode /> : <OptimizationMode />}
    </div>
  )
}
