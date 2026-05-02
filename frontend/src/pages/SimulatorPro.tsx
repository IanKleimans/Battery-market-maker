/** The Pro simulator — IEEE 14-bus / 30-bus / 5-bus with Live and Optimization modes. */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { Wand2, Sparkles, Loader2, AlertTriangle, FileText } from 'lucide-react'
import { api } from '@/api/client'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useSimulator } from '@/store/simulator'
import { useSolveSimulator } from '@/hooks/useSolveSimulator'
import { useFrameState } from '@/hooks/useFrameState'
import { useLiveDispatch } from '@/hooks/useLiveDispatch'
import { useLiveFrame } from '@/hooks/useLiveFrame'
import { formatLMP, formatMs, formatMW, formatSeconds, formatUSD } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  Select,
  Skeleton,
  toast,
} from '@/components/ui'
import {
  AssetPanel,
  NetworkDiagram,
  TimeScrubber,
  ResultsPanel,
} from '@/components/network'
import { LiveCalculations } from '@/components/network/LiveCalculations'
import { LiveControls } from '@/components/network/LiveControls'
import { MarketMakerPanel } from '@/components/network/MarketMakerPanel'
import { SolverTraceDrawer } from '@/components/network/SolverTraceDrawer'
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
        {(['live', 'optimization', 'market_maker'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`h-7 px-3 text-xs rounded font-medium transition-colors ${
              mode === m
                ? 'bg-accent text-white'
                : 'text-text-2 hover:text-text-1'
            }`}
            onClick={() => setMode(m)}
          >
            {m === 'market_maker' ? 'Market maker' : m.charAt(0).toUpperCase() + m.slice(1)}
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
  const setSelectedBus = useSimulator((s) => s.setSelectedBus)
  const selectedBus = useSimulator((s) => s.selectedBus)
  const live = useSimulator((s) => s.liveResult)
  const liveLoading = useSimulator((s) => s.liveLoading)
  const liveError = useSimulator((s) => s.liveError)

  const { data: net } = useQuery({
    queryKey: ['network', network],
    queryFn: () => api.getNetwork(network),
  })

  useLiveDispatch(true)
  const frame = useLiveFrame(live)
  const infeasible = live?.status === 'infeasible'

  if (!net) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="h-64 w-3/4 max-w-2xl" />
      </div>
    )
  }

  return (
    <div className="flex-1 grid grid-cols-[320px_1fr] min-h-0">
      <aside className="border-r border-border bg-surface/40 p-3 flex flex-col gap-3 overflow-hidden min-h-0">
        <Card className="p-3">
          {live && !infeasible && (
            <div className="text-[11px] mono text-text-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <div>
                Cost <span className="text-text-1">{formatUSD(live.total_cost)}/h</span>
              </div>
              <div>
                Solver <span className="text-text-1">{formatMs(live.solve_time_seconds)}</span>
              </div>
            </div>
          )}
          {infeasible && (
            <div className="flex items-start gap-1.5 text-[11px] text-warning mono">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                Infeasible. Lower the load multiplier, restore an outaged line, or
                bring a generator back online.
              </span>
            </div>
          )}
          {liveError && (
            <p className="mt-2 text-[11px] text-danger mono break-words">
              {liveError}
            </p>
          )}
        </Card>

        <div className="flex-1 min-h-0">
          <LiveControls network={net} />
        </div>

        {selectedBus !== null && (
          <Card className="p-3 animate-fade-in">
            <h4 className="text-xs font-semibold text-text-1 mb-1">Bus {selectedBus}</h4>
            {frame && (
              <div className="text-[11px] mono text-text-2 space-y-0.5">
                <div>
                  LMP <span className="text-text-1">{formatLMP(frame.busLMP[selectedBus])}</span>
                </div>
                <div>
                  Load <span className="text-text-1">{formatMW(frame.busLoad[selectedBus])}</span>
                </div>
              </div>
            )}
          </Card>
        )}

        <LiveCalculations network={net} result={live} selectedBus={selectedBus} />
      </aside>

      <section className="relative bg-bg flex items-stretch min-h-0">
        <AnimatePresence>
          {liveLoading && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-[10px] mono text-text-2 bg-surface/80 backdrop-blur-sm px-2 py-1 rounded border border-border"
            >
              <Loader2 size={10} className="animate-spin text-accent" />
              Recomputing
            </motion.div>
          )}
        </AnimatePresence>
        <NetworkDiagram
          network={net}
          frame={frame}
          selectedBus={selectedBus}
          onBusClick={(b) => setSelectedBus(b === selectedBus ? null : b)}
          baseline={!frame || infeasible}
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
  const [traceOpen, setTraceOpen] = useState(false)

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
          {result && !isSolving && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setTraceOpen(true)}
            >
              <FileText size={14} /> Show calculations
            </Button>
          )}
          {solveError && (
            <p className="text-[11px] text-danger mono">{solveError}</p>
          )}
          {solveElapsed !== null && !isSolving && !solveError && (
            <p className="text-[11px] text-text-2 mono">
              Solved in {formatSeconds(solveElapsed)}
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
                  {solveElapsed !== null ? `${formatSeconds(solveElapsed, 1)} elapsed` : 'building LP…'}
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

      {result && (
        <SolverTraceDrawer
          open={traceOpen}
          onOpenChange={setTraceOpen}
          result={result}
          network={net}
        />
      )}
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

  usePageMeta({
    title: 'Pro Simulator',
    description:
      'IEEE 5/14/30-bus simulator with batteries, AI data centers, renewables, multi-period DC-OPF, and live LMPs.',
  })

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
      {mode === 'live' ? (
        <LiveMode />
      ) : mode === 'market_maker' ? (
        <MarketMakerMode />
      ) : (
        <OptimizationMode />
      )}
    </div>
  )
}

// ---------- Market-Maker mode ----------

function MarketMakerMode() {
  const network = useSimulator((s) => s.network)
  const horizon = useSimulator((s) => s.horizonHours)
  const timestep = useSimulator((s) => s.timestepMinutes)
  const loadMul = useSimulator((s) => s.loadMultiplier)
  const forecast = useSimulator((s) => s.forecastSource)
  const placement = useSimulator((s) => s.placementMode)
  const setPlacement = useSimulator((s) => s.setPlacementMode)
  const batteries = useSimulator((s) => s.batteries)
  const dataCenters = useSimulator((s) => s.dataCenters)
  const renewables = useSimulator((s) => s.renewables)
  const addBattery = useSimulator((s) => s.addBattery)
  const addDC = useSimulator((s) => s.addDataCenter)
  const addRen = useSimulator((s) => s.addRenewable)
  const setSelectedBus = useSimulator((s) => s.setSelectedBus)
  const result = useSimulator((s) => s.marketResult)
  const isLoading = useSimulator((s) => s.marketLoading)
  const error = useSimulator((s) => s.marketError)
  const setResult = useSimulator((s) => s.setMarketResult)
  const setLoading = useSimulator((s) => s.setMarketLoading)
  const setError = useSimulator((s) => s.setMarketError)

  const { data: net } = useQuery({
    queryKey: ['network', network],
    queryFn: () => api.getNetwork(network),
  })

  const handleBusClick = (busId: number) => {
    if (!placement) {
      setSelectedBus(busId)
      return
    }
    if (placement === 'battery') addBattery(makeBattery(busId, batteries.length))
    else if (placement === 'data_center') addDC(makeDC(busId, dataCenters.length))
    else if (placement === 'renewable') addRen(makeRenewable(busId, renewables.length))
    setPlacement(null)
  }

  const runAnalysis = async () => {
    if (dataCenters.length === 0) {
      toast('warning', {
        title: 'Place a data center first',
        description: 'Market-maker analysis requires at least one data center as the leader.',
      })
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await api.stackelberg({
        network,
        horizon_hours: horizon,
        timestep_minutes: timestep,
        load_multiplier: loadMul,
        batteries,
        data_centers: dataCenters,
        renewables,
        forecast: { source: forecast },
        leader_data_center_id: null,
      })
      setResult(r)
      toast('success', {
        title: 'Stackelberg solved',
        description: `${r.iterations.length} iterations · gain ${formatUSD(r.stackelberg_gain_usd)}`,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Analysis failed'
      setError(msg)
      toast('danger', { title: 'Analysis failed', description: msg })
    } finally {
      setLoading(false)
    }
  }

  if (!net) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="h-64 w-3/4 max-w-2xl" />
      </div>
    )
  }

  return (
    <div className="flex-1 grid grid-cols-[300px_1fr_400px] grid-rows-[auto_1fr] min-h-0">
      <div className="col-span-3 px-4 py-2 border-b border-border bg-surface/40 text-[11px] text-text-2 mono flex items-center gap-2">
        <Sparkles size={12} className="text-accent" />
        Stackelberg analysis: a flexible AI campus placed at a thinly-traded node
        moves its own LMP. We compare price-taker (campus ignores its own impact)
        against Stackelberg-aware (campus accounts for it). The gain is the value
        of that awareness.
      </div>

      {/* Left: asset placement */}
      <aside className="row-start-2 border-r border-border bg-surface/40 p-3 flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <AssetPanel />
        </div>
        <div className="border-t border-border pt-3">
          <Button
            size="lg"
            className="w-full"
            onClick={runAnalysis}
            loading={isLoading}
            disabled={isLoading}
          >
            <Wand2 size={16} /> Run Stackelberg analysis
          </Button>
          {error && <p className="text-[11px] text-danger mono mt-2 break-words">{error}</p>}
          {dataCenters.length === 0 && (
            <p className="text-[11px] text-text-3 mono mt-2">
              Place a data center on the network to enable analysis.
            </p>
          )}
        </div>
      </aside>

      {/* Center: network */}
      <section className="row-start-2 relative bg-bg flex items-stretch min-h-0">
        <NetworkDiagram
          network={net}
          batteries={batteries}
          dataCenters={dataCenters}
          renewables={renewables}
          placementMode={placement}
          onBusClick={handleBusClick}
          baseline
          width="100%"
          height="100%"
        />
        {result && (
          <div className="absolute top-2 left-2 bg-surface/90 backdrop-blur-sm border border-border rounded p-2 text-[11px] mono text-text-2 max-w-xs">
            <div className="text-text-1 font-semibold text-xs mb-1">
              Leader on bus {result.leader_bus}
            </div>
            <div>
              LMP shift{' '}
              <span className="text-warning">
                ±{formatLMP(result.max_lmp_impact_usd_per_mwh)}
              </span>
            </div>
            <div>
              Gain{' '}
              <span className={result.stackelberg_gain_usd >= 0 ? 'text-success' : 'text-danger'}>
                {formatUSD(result.stackelberg_gain_usd)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Right: results */}
      <aside className="row-start-2 border-l border-border bg-surface/40 p-3 min-h-0 overflow-hidden">
        {result ? (
          <MarketMakerPanel result={result} />
        ) : (
          <Card className="text-xs text-text-2 leading-relaxed">
            <Sparkles className="text-accent mb-2" size={16} />
            Place a data center on the network, then click{' '}
            <span className="mono text-text-1">Run Stackelberg analysis</span> to
            compare price-taker vs market-maker dispatch.
          </Card>
        )}
      </aside>
    </div>
  )
}
