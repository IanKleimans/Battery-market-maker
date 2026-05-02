/** Tabbed Live-mode control surface.
 *
 * Five tabs cover everything that ships in a SinglePeriodRequest:
 *   Loads      per-bus MW slider + master multiplier
 *   Generators per-gen capacity + cost + online toggle
 *   Lines      per-line capacity + outage toggle
 *   Renewables per-wind-gen availability slider + global wind master
 *   Saved      named save/load via localStorage + Stress Test button
 *
 * Every change updates the simulator store, which retriggers useLiveDispatch
 * (debounced 100 ms, AbortController-cancelled). */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bookmark,
  Download,
  Power,
  RotateCcw,
  Save,
  Trash2,
  Wind,
  Zap,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Slider,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  toast,
} from '@/components/ui'
import { useSimulator } from '@/store/simulator'
import { FUEL_COLORS } from '@/lib/colors'
import { formatMW, formatPct } from '@/lib/format'
import {
  deleteScenario,
  listScenarios,
  saveScenario,
  type SavedLiveScenario,
} from '@/lib/livescenarios'
import type { NetworkData } from '@/types/api'
import { StressTest } from './StressTest'

export interface LiveControlsProps {
  network: NetworkData
}

export function LiveControls({ network }: LiveControlsProps) {
  return (
    <Tabs defaultValue="loads" className="flex flex-col h-full">
      <TabList className="self-start">
        <Tab value="loads">Loads</Tab>
        <Tab value="gens">Gens</Tab>
        <Tab value="lines">Lines</Tab>
        {network.generators.some((g) => g.fuel === 'wind') && (
          <Tab value="renew">Wind</Tab>
        )}
        <Tab value="saved">Saved</Tab>
      </TabList>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-2 space-y-3">
        <TabPanel value="loads">
          <LoadsTab network={network} />
        </TabPanel>
        <TabPanel value="gens">
          <GensTab network={network} />
        </TabPanel>
        <TabPanel value="lines">
          <LinesTab network={network} />
        </TabPanel>
        <TabPanel value="renew">
          <WindTab network={network} />
        </TabPanel>
        <TabPanel value="saved">
          <SavedTab network={network} />
        </TabPanel>
      </div>
    </Tabs>
  )
}

// -------- Loads --------

function LoadsTab({ network }: { network: NetworkData }) {
  const loadMul = useSimulator((s) => s.loadMultiplier)
  const setLoadMul = useSimulator((s) => s.setLoadMultiplier)
  const overrides = useSimulator((s) => s.liveOverrides.loads)
  const setOverride = useSimulator((s) => s.setLoadOverride)
  const reset = useSimulator((s) => s.resetLiveOverrides)

  const loads = useMemo(() => network.loads.filter((l) => l.peak_mw > 0), [network])

  return (
    <Card className="p-3 space-y-3">
      <Slider
        label="Master multiplier"
        value={loadMul}
        min={0.3}
        max={1.6}
        step={0.05}
        onChange={setLoadMul}
        format={(v) => `${formatPct(v)} of nameplate`}
      />
      <div className="border-t border-border" />
      <div className="text-[10px] uppercase tracking-wider text-text-3">
        Per-bus override
      </div>
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {loads.map((ld) => {
          const peak = ld.peak_mw * 0.7 * loadMul
          const v = overrides[ld.bus] ?? peak
          return (
            <Slider
              key={ld.bus}
              label={`Bus ${ld.bus}`}
              value={v}
              min={0}
              max={Math.max(ld.peak_mw * 1.5, 50)}
              step={1}
              onChange={(mw) => setOverride(ld.bus, mw)}
              format={(mw) => `${formatMW(mw)} (peak ${formatMW(ld.peak_mw)})`}
            />
          )
        })}
      </div>
      <Button variant="secondary" size="sm" className="w-full" onClick={reset}>
        <RotateCcw size={12} /> Reset all
      </Button>
    </Card>
  )
}

// -------- Generators --------

function GensTab({ network }: { network: NetworkData }) {
  const overrides = useSimulator((s) => s.liveOverrides.gens)
  const setOverride = useSimulator((s) => s.setGenOverride)

  return (
    <div className="space-y-2">
      {network.generators.map((g) => {
        const ov = overrides[g.id] ?? {}
        const cap = ov.capacity_mw ?? g.capacity_mw
        const cost = ov.cost_per_mwh ?? g.cost_per_mwh
        const online = ov.online !== false
        return (
          <Card key={g.id} className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: FUEL_COLORS[g.fuel] }}
              />
              <span className="text-xs font-semibold text-text-1">{g.name}</span>
              <Badge tone="neutral" className="capitalize text-[10px]">
                {g.fuel}
              </Badge>
              <span className="flex-1" />
              <Switch
                checked={online}
                onCheckedChange={(c) => setOverride(g.id, { online: c })}
                aria-label={`${g.name} online`}
              />
            </div>
            <Slider
              label="Capacity"
              value={cap}
              min={0}
              max={g.capacity_mw * 2}
              step={5}
              onChange={(v) => setOverride(g.id, { capacity_mw: v })}
              format={(v) => `${formatMW(v)} (nameplate ${formatMW(g.capacity_mw)})`}
            />
            <Slider
              label="Marginal cost"
              value={cost}
              min={0}
              max={200}
              step={1}
              onChange={(v) => setOverride(g.id, { cost_per_mwh: v })}
              format={(v) => `$${v}/MWh`}
            />
            {(ov.capacity_mw !== undefined || ov.cost_per_mwh !== undefined || ov.online === false) && (
              <button
                type="button"
                className="text-[10px] mono text-text-3 hover:text-text-1 self-end"
                onClick={() => setOverride(g.id, null)}
              >
                Reset
              </button>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// -------- Lines --------

function LinesTab({ network }: { network: NetworkData }) {
  const caps = useSimulator((s) => s.liveOverrides.lineCaps)
  const outages = useSimulator((s) => s.liveOverrides.lineOutages)
  const setCap = useSimulator((s) => s.setLineCapOverride)
  const setOutage = useSimulator((s) => s.setLineOutage)
  const outageSet = useMemo(() => new Set(outages), [outages])

  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
      {network.lines.map((ln) => {
        const cap = caps[ln.id] ?? ln.capacity_mva
        const out = outageSet.has(ln.id)
        return (
          <Card key={ln.id} className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-accent" />
              <span className="text-xs font-semibold text-text-1">{ln.name}</span>
              <span className="text-[10px] text-text-2 mono">
                {ln.from_bus} → {ln.to_bus}
              </span>
              <span className="flex-1" />
              <Switch
                checked={!out}
                onCheckedChange={(c) => setOutage(ln.id, !c)}
                aria-label={`${ln.name} in service`}
              />
            </div>
            <Slider
              label="Thermal capacity"
              value={cap}
              min={0}
              max={ln.capacity_mva * 2}
              step={5}
              onChange={(v) => setCap(ln.id, v)}
              format={(v) => `${formatMW(v)} (nameplate ${formatMW(ln.capacity_mva)})`}
            />
            {out && (
              <p className="text-[10px] text-warning mono">Forced offline</p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// -------- Wind / renewables --------

function WindTab({ network }: { network: NetworkData }) {
  const wind = useSimulator((s) => s.windAvailability)
  const setWind = useSimulator((s) => s.setWindAvailability)
  const windGens = useMemo(
    () => network.generators.filter((g) => g.fuel === 'wind'),
    [network],
  )

  return (
    <Card className="p-3 space-y-3">
      <Slider
        label="Wind availability"
        value={wind}
        min={0}
        max={1}
        step={0.05}
        onChange={setWind}
        format={(v) => formatPct(v)}
      />
      <p className="text-[10px] text-text-2 mono">
        Derates {windGens.length} wind generator{windGens.length === 1 ? '' : 's'}{' '}
        proportionally. Per-generator overrides land in the Gens tab.
      </p>
      {windGens.length === 0 && (
        <p className="text-[10px] text-text-3 mono">
          This network has no wind generators.
        </p>
      )}
      {windGens.map((g) => (
        <div
          key={g.id}
          className="flex items-center gap-2 text-[11px] mono text-text-2"
        >
          <Wind size={11} className="text-cyan-300" />
          <span className="text-text-1">{g.name}</span>
          <span className="flex-1 text-right">
            available {formatMW(g.capacity_mw * wind)} of {formatMW(g.capacity_mw)}
          </span>
        </div>
      ))}
    </Card>
  )
}

// -------- Saved snapshots --------

function SavedTab({ network }: { network: NetworkData }) {
  const [items, setItems] = useState<SavedLiveScenario[]>(() => listScenarios())
  const [name, setName] = useState('')

  const networkId = useSimulator((s) => s.network)
  const loadMul = useSimulator((s) => s.loadMultiplier)
  const wind = useSimulator((s) => s.windAvailability)
  const overrides = useSimulator((s) => s.liveOverrides)
  const apply = useSimulator((s) => s.applyLiveOverrides)
  const setLoadMul = useSimulator((s) => s.setLoadMultiplier)
  const setWind = useSimulator((s) => s.setWindAvailability)

  const refresh = () => setItems(listScenarios())

  const handleSave = () => {
    const trimmed = name.trim() || `Snapshot ${new Date().toLocaleTimeString()}`
    const s = saveScenario({
      name: trimmed,
      network: networkId,
      load_multiplier: loadMul,
      wind_availability: wind,
      overrides,
    })
    setName('')
    refresh()
    toast('success', { title: 'Saved', description: s.name })
  }

  const handleLoad = (s: SavedLiveScenario) => {
    if (s.network !== networkId) {
      toast('warning', {
        title: 'Different network',
        description: `${s.name} was saved on ${s.network}; switch network to apply.`,
      })
      return
    }
    setLoadMul(s.load_multiplier)
    setWind(s.wind_availability)
    apply(s.overrides)
    toast('info', { title: 'Loaded', description: s.name })
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-text-3">
          Save current state
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Snapshot name"
            className="flex-1 h-8 px-2 text-xs bg-bg border border-border rounded text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent"
          />
          <Button size="sm" onClick={handleSave}>
            <Save size={12} /> Save
          </Button>
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-text-3">
          Saved snapshots
        </div>
        {items.length === 0 ? (
          <p className="text-[11px] text-text-3 mono">
            No saved snapshots yet. Configure the simulator above and click Save.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((s) => {
              const wrongNet = s.network !== networkId
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-[11px] mono"
                >
                  <Bookmark size={11} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-text-1 truncate">{s.name}</div>
                    <div className="text-text-3">
                      {s.network} · ×{s.load_multiplier.toFixed(2)} load
                      {wrongNet && (
                        <span className="text-warning"> · network mismatch</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1 text-text-2 hover:text-accent"
                    aria-label={`Load ${s.name}`}
                    onClick={() => handleLoad(s)}
                  >
                    <Download size={12} />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-text-2 hover:text-danger"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => {
                      deleteScenario(s.id)
                      refresh()
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-3 mb-2">
          <Power size={11} /> Stress test
        </div>
        <StressTest network={network} />
      </Card>
    </div>
  )
}
