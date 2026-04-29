/** Right-panel result tabs for the Pro simulator. */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line as RechartsLine,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import { Tabs, TabList, Tab, TabPanel, Card } from '@/components/ui'
import { FUEL_COLORS } from '@/lib/colors'
import {
  formatLMP,
  formatMW,
  formatMWh,
  formatUSD,
  formatHourLabel,
} from '@/lib/format'
import { useSimulator } from '@/store/simulator'
import type { MultiPeriodSolution, NetworkData } from '@/types/api'

export function ResultsPanel({
  result,
  network,
}: {
  result: MultiPeriodSolution
  network: NetworkData
}) {
  return (
    <Tabs defaultValue="dispatch" className="h-full flex flex-col">
      <TabList className="self-start mb-3">
        <Tab value="dispatch">Dispatch</Tab>
        <Tab value="storage">Storage</Tab>
        <Tab value="prices">Prices</Tab>
        <Tab value="revenue">Revenue</Tab>
      </TabList>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <TabPanel value="dispatch">
          <DispatchTab result={result} network={network} />
        </TabPanel>
        <TabPanel value="storage">
          <StorageTab result={result} />
        </TabPanel>
        <TabPanel value="prices">
          <PricesTab result={result} network={network} />
        </TabPanel>
        <TabPanel value="revenue">
          <RevenueTab result={result} />
        </TabPanel>
      </div>
    </Tabs>
  )
}

// ---------------- Dispatch ----------------

function DispatchTab({
  result,
  network,
}: {
  result: MultiPeriodSolution
  network: NetworkData
}) {
  const step = useSimulator((s) => s.scrubberStep)
  const data = useMemo(() => {
    const out: Array<Record<string, number | string>> = []
    for (let t = 0; t < result.n_timesteps; t++) {
      const row: Record<string, number | string> = {
        t,
        time: formatHourLabel(result.timestamps[t]!),
      }
      for (const gd of result.generator_dispatch) {
        const gen = network.generators.find((g) => g.id === gd.gen_id)
        if (!gen) continue
        row[gen.name] = gd.p_mw[t] ?? 0
      }
      out.push(row)
    }
    return out
  }, [result, network])

  const fuels = useMemo(
    () =>
      result.generator_dispatch
        .map((gd) => network.generators.find((g) => g.id === gd.gen_id))
        .filter(Boolean) as NetworkData['generators'],
    [result.generator_dispatch, network.generators],
  )

  return (
    <Card className="p-3">
      <h4 className="text-xs font-semibold text-text-1 mb-1">
        Generator dispatch over horizon
      </h4>
      <p className="text-[11px] text-text-2 mb-3">
        Stacked MW by fuel. Vertical line = current scrubber position.
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#162040' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#162040' }}
              label={{
                value: 'MW',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 10, fill: '#64748b' },
              }}
            />
            <RTooltip
              contentStyle={{
                background: '#06080f',
                border: '1px solid #162040',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'IBM Plex Mono',
              }}
              labelStyle={{ color: '#f1f5f9' }}
              cursor={{ stroke: '#2563eb', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <ReferenceLine
              x={data[step]?.time as string}
              stroke="#2563eb"
              strokeDasharray="3 3"
            />
            {fuels.map((g) => (
              <Area
                key={g.id}
                type="step"
                dataKey={g.name}
                stackId="1"
                stroke={FUEL_COLORS[g.fuel]}
                fill={FUEL_COLORS[g.fuel]}
                fillOpacity={0.4}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ---------------- Storage ----------------

function StorageTab({ result }: { result: MultiPeriodSolution }) {
  if (result.battery_trajectories.length === 0) {
    return (
      <Card>
        <p className="text-xs text-text-2">
          No batteries placed. Add a battery in the left panel and rerun the optimization to see SOC trajectories here.
        </p>
      </Card>
    )
  }
  const step = useSimulator((s) => s.scrubberStep)

  return (
    <div className="space-y-3">
      {result.battery_trajectories.map((bat) => {
        const data = bat.soc_mwh.map((soc, t) => ({
          t,
          time: formatHourLabel(result.timestamps[t]!),
          soc,
          charge: -(bat.charge_mw[t] ?? 0),
          discharge: bat.discharge_mw[t] ?? 0,
        }))
        return (
          <Card key={bat.asset_id} className="p-3">
            <h4 className="text-xs font-semibold text-text-1 mb-1">{bat.asset_id}</h4>
            <p className="text-[11px] text-text-2 mb-2">SOC trajectory (MWh)</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                  <RTooltip
                    contentStyle={{
                      background: '#06080f',
                      border: '1px solid #162040',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine
                    x={data[step]?.time as string}
                    stroke="#2563eb"
                    strokeDasharray="3 3"
                  />
                  <RechartsLine
                    type="monotone"
                    dataKey="soc"
                    stroke="#10b981"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-text-2 mt-2 mb-1">
              Charge (red) ↔ discharge (green) MW
            </p>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                  <RTooltip
                    contentStyle={{
                      background: '#06080f',
                      border: '1px solid #162040',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine y={0} stroke="#162040" />
                  <ReferenceLine
                    x={data[step]?.time as string}
                    stroke="#2563eb"
                    strokeDasharray="3 3"
                  />
                  <Bar dataKey="charge" fill="#ef4444" isAnimationActive={false} />
                  <Bar dataKey="discharge" fill="#10b981" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ---------------- Prices (LMP heatmap) ----------------

function PricesTab({
  result,
  network,
}: {
  result: MultiPeriodSolution
  network: NetworkData
}) {
  const step = useSimulator((s) => s.scrubberStep)
  const setStep = useSimulator((s) => s.setScrubberStep)
  const { min, max } = useMemo(() => {
    let mn = Infinity,
      mx = -Infinity
    for (const lmp of result.lmps) {
      for (const v of lmp.lmp_per_mwh) {
        if (v < mn) mn = v
        if (v > mx) mx = v
      }
    }
    return { min: mn, max: mx }
  }, [result.lmps])

  return (
    <Card className="p-3">
      <h4 className="text-xs font-semibold text-text-1 mb-1">LMP heatmap</h4>
      <p className="text-[11px] text-text-2 mb-3">
        Buses (rows) × time (cols). Click any cell to jump to that timestep.
      </p>
      <div
        className="grid gap-px overflow-x-auto"
        style={{
          gridTemplateColumns: `60px repeat(${result.n_timesteps}, minmax(8px, 1fr))`,
        }}
        role="grid"
        aria-label="LMP heatmap"
      >
        <div />
        {result.timestamps.map((t, ti) => (
          <div
            key={ti}
            className={`text-[9px] mono text-text-2 text-center ${
              ti === step ? 'text-accent font-semibold' : ''
            } ${ti % 6 === 0 ? '' : 'opacity-0'}`}
          >
            {formatHourLabel(t)}
          </div>
        ))}
        {result.lmps.map((lmp) => {
          const bus = network.buses.find((b) => b.id === lmp.bus)
          return (
            <div className="contents" key={lmp.bus}>
              <div className="text-[10px] mono text-text-2 pr-1 truncate">
                {bus?.name ?? `Bus ${lmp.bus}`}
              </div>
              {lmp.lmp_per_mwh.map((v, ti) => {
                const t = (v - min) / Math.max(max - min, 0.001)
                const r = Math.round(37 + t * (239 - 37))
                const g = Math.round(99 + t * (68 - 99))
                const b = Math.round(235 + t * (68 - 235))
                return (
                  <button
                    type="button"
                    key={ti}
                    onClick={() => setStep(ti)}
                    title={`${bus?.name ?? `Bus ${lmp.bus}`} @ ${formatHourLabel(
                      result.timestamps[ti]!,
                    )} → ${formatLMP(v)}`}
                    className={`h-4 transition-transform hover:scale-110 ${
                      ti === step ? 'ring-1 ring-accent' : ''
                    }`}
                    style={{ background: `rgb(${r}, ${g}, ${b})` }}
                    aria-label={`LMP ${formatLMP(v)}`}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-3 text-[10px] mono text-text-2">
        <span>{formatLMP(min)}</span>
        <span>{formatLMP(max)}</span>
      </div>
    </Card>
  )
}

// ---------------- Revenue ----------------

function RevenueTab({ result }: { result: MultiPeriodSolution }) {
  if (result.revenue.length === 0) {
    return (
      <Card>
        <p className="text-xs text-text-2">
          No assets placed — revenue breakdown appears after running the optimization with at least one battery, data center, or renewable.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {result.revenue.map((r, i) => (
        <motion.div
          key={r.asset_id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-1">{r.asset_id}</span>
              <span className="text-[10px] mono text-text-2 capitalize">
                {r.asset_kind.replace('_', ' ')}
              </span>
            </div>
            <div className="space-y-1.5">
              {r.compute_revenue !== 0 && (
                <Row label="Compute revenue" value={r.compute_revenue} positive />
              )}
              {r.energy_revenue !== 0 && (
                <Row
                  label={r.energy_revenue >= 0 ? 'Energy revenue' : 'Energy cost'}
                  value={r.energy_revenue}
                  positive={r.energy_revenue >= 0}
                />
              )}
              {r.degradation_cost !== 0 && (
                <Row label="Degradation" value={-r.degradation_cost} positive={false} />
              )}
              {r.sla_penalty !== 0 && (
                <Row label="SLA penalty" value={-r.sla_penalty} positive={false} />
              )}
              {r.curtailment_penalty !== 0 && (
                <Row
                  label="Curtailment penalty"
                  value={-r.curtailment_penalty}
                  positive={false}
                />
              )}
              <div className="border-t border-border my-2" />
              <Row
                label={<span className="font-semibold">Total</span>}
                value={r.total}
                positive={r.total >= 0}
                bold
              />
            </div>
          </Card>
        </motion.div>
      ))}
      <p className="text-[10px] text-text-2 mono px-1">
        Per-horizon totals · {result.horizon_hours} h × {result.timestep_minutes} min steps
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  positive,
  bold,
}: {
  label: React.ReactNode
  value: number
  positive: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-2">{label}</span>
      <span
        className={`mono tabular-nums ${
          positive ? 'text-success' : 'text-danger'
        } ${bold ? 'text-sm font-semibold' : ''}`}
      >
        {value >= 0 ? '+' : ''}
        {formatUSD(value, true)}
      </span>
    </div>
  )
}

// silence unused import lint
void formatMW
void formatMWh
