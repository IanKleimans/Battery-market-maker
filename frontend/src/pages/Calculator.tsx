/** GPU cluster cost & siting calculator. */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Cpu,
  Download,
  FileText,
  Info,
  Leaf,
  Server,
  Zap,
  ZapOff,
} from 'lucide-react'
import {
  Button,
  Card,
  CardSubtitle,
  CardTitle,
  Select,
  Slider,
  Switch,
} from '@/components/ui'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useThemeColors } from '@/lib/theme'
import { formatCompact, formatFixed, formatPct, formatUSD } from '@/lib/format'
import {
  DEFAULT_INPUTS,
  GPU_MODELS,
  PRESETS,
  REGIONS,
  compute,
  effectiveRate,
  effectiveTdpWatts,
  type CalculatorInputs,
  type Region,
} from '@/lib/gpuCalculator'
import { downloadCSV, downloadPDF } from '@/lib/exportCalculator'

export function Calculator() {
  usePageMeta({
    title: 'GPU Calculator',
    description:
      'Estimate annual electricity cost for AI training and inference clusters across 12 regions. Includes co-located storage and demand response revenue.',
  })
  const colors = useThemeColors()
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS)
  const [showSources, setShowSources] = useState(false)

  const outputs = useMemo(() => compute(inputs), [inputs])

  const set = <K extends keyof CalculatorInputs>(k: K, v: CalculatorInputs[K]) =>
    setInputs((s) => ({ ...s, [k]: v }))

  const tdp = effectiveTdpWatts(inputs)
  const rate = effectiveRate(inputs)
  const region = REGIONS.find((r) => r.id === inputs.region)
  const reduction =
    outputs.annual_cost_usd > 0
      ? (1 - outputs.net_cost_usd / outputs.annual_cost_usd) * 100
      : 0

  return (
    <div className="flex-1 p-6 max-w-[1400px] mx-auto w-full space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-1 flex items-center gap-2">
            <Cpu className="text-accent" size={20} />
            GPU Cluster Cost & Siting Calculator
          </h1>
          <p className="text-sm text-text-2 mt-1 max-w-2xl">
            Estimate annual electricity cost for an AI training or inference cluster
            across siting options. GPU power, utilization, PUE, regional rates, and
            optional co-located storage / demand response revenue.
          </p>
        </div>
        <Link
          to="/simulator/pro?scenario=ai_campus_at_thin_node"
          className="flex items-center gap-2 px-3 py-2 text-xs rounded border border-accent/40 bg-accent/10 hover:bg-accent/20 text-text-1 transition-colors max-w-xs"
        >
          <Server size={14} className="text-accent shrink-0" />
          <span>
            Want to model how this cluster interacts with grid prices? Open the
            Simulator with a 500 MW data center pre-placed.
          </span>
          <ArrowRight size={14} className="text-accent shrink-0" />
        </Link>
      </div>

      {/* Preset buttons */}
      <Card className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-text-3 mb-2">
          Scenario presets
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setInputs(p.inputs)}
              className="text-left p-2 rounded border border-border hover:border-accent hover:bg-surface-hover transition-colors"
            >
              <div className="text-xs font-semibold text-text-1">{p.label}</div>
              <div className="text-[10px] text-text-2 mt-0.5">{p.description}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        {/* Inputs */}
        <div className="space-y-3">
          <Card className="p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-text-3">
              Cluster
            </div>
            <NumberInput
              label="Number of GPUs"
              value={inputs.num_gpus}
              min={1_000}
              max={5_000_000}
              step={1_000}
              onChange={(v) => set('num_gpus', v)}
              format={(v) => `${formatCompact(v)} GPUs`}
            />
            <div>
              <CardSubtitle>GPU model</CardSubtitle>
              <Select
                value={inputs.gpu_model}
                onValueChange={(v) => set('gpu_model', v)}
                size="sm"
                options={GPU_MODELS.map((m) => ({
                  value: m.id,
                  label: m.name,
                  description: m.id === 'custom' ? 'Set TDP below' : `${m.tdp_w} W TDP`,
                }))}
              />
              {inputs.gpu_model === 'custom' && (
                <div className="mt-2">
                  <Slider
                    label="Custom TDP"
                    value={inputs.custom_tdp_w ?? 700}
                    min={50}
                    max={2000}
                    step={50}
                    onChange={(v) => set('custom_tdp_w', v)}
                    format={(v) => `${v} W`}
                  />
                </div>
              )}
              <p className="text-[10px] text-text-3 mono mt-1">
                Effective TDP {tdp} W
              </p>
            </div>
            <Slider
              label="Utilization"
              value={inputs.utilization}
              min={0.1}
              max={1.0}
              step={0.05}
              onChange={(v) => set('utilization', v)}
              format={(v) => formatPct(v)}
            />
            <Slider
              label="PUE (Power Usage Effectiveness)"
              value={inputs.pue}
              min={1.05}
              max={2.0}
              step={0.01}
              onChange={(v) => set('pue', v)}
              format={(v) => v.toFixed(2)}
            />
            <p className="text-[11px] text-text-2 mono">
              IT load × utilization × PUE = total facility load
            </p>
          </Card>

          <Card className="p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-text-3">
              Siting
            </div>
            <Select
              value={inputs.region}
              onValueChange={(v) => set('region', v)}
              size="sm"
              options={REGIONS.map((r) => ({
                value: r.id,
                label: r.name,
                description: r.id === 'custom'
                  ? 'Set rate below'
                  : `$${r.rate_per_kwh.toFixed(3)}/kWh · ${r.carbon_g_per_kwh} g CO2/kWh`,
              }))}
            />
            {inputs.region === 'custom' && (
              <Slider
                label="Custom rate"
                value={inputs.custom_rate_per_kwh ?? 0.10}
                min={0.01}
                max={0.50}
                step={0.005}
                onChange={(v) => set('custom_rate_per_kwh', v)}
                format={(v) => `$${v.toFixed(3)}/kWh`}
              />
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-text-1">Solar PPA</div>
                <div className="text-[10px] text-text-2 mono">
                  $0.057/kWh, swaps the regional grid rate
                </div>
              </div>
              <Switch
                checked={inputs.solar_ppa}
                onCheckedChange={(c) => set('solar_ppa', c)}
                aria-label="Solar PPA"
              />
            </div>
            <p className="text-[11px] text-text-2 mono">
              Effective rate <span className="text-text-1">${rate.toFixed(3)}/kWh</span>
            </p>
          </Card>

          <Card className="p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-text-3">
              Revenue offsets
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-text-1 flex items-center gap-1">
                  <Zap size={11} className="text-accent" /> Co-located storage
                </div>
                <div className="text-[10px] text-text-2 mono">
                  Battery participates in ancillary services
                </div>
              </div>
              <Switch
                checked={inputs.storage.enabled}
                onCheckedChange={(c) =>
                  set('storage', { ...inputs.storage, enabled: c })
                }
                aria-label="Co-located storage"
              />
            </div>
            {inputs.storage.enabled && (
              <div className="space-y-2 pl-2 border-l-2 border-accent/30">
                <Slider
                  label="Battery capacity"
                  value={inputs.storage.capacity_mwh}
                  min={50}
                  max={2000}
                  step={50}
                  onChange={(v) => set('storage', { ...inputs.storage, capacity_mwh: v })}
                  format={(v) => `${v} MWh`}
                />
                <Slider
                  label="Reg revenue"
                  value={inputs.storage.revenue_per_kw_yr}
                  min={5}
                  max={100}
                  step={1}
                  onChange={(v) => set('storage', { ...inputs.storage, revenue_per_kw_yr: v })}
                  format={(v) => `$${v}/kW-yr`}
                />
                <p className="text-[10px] text-text-3 mono">
                  Default $35/kW-yr matches PJM 2025-26 reg averages.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-text-1 flex items-center gap-1">
                  <ZapOff size={11} className="text-warning" /> Demand response
                </div>
                <div className="text-[10px] text-text-2 mono">
                  Cluster curtails on grid events
                </div>
              </div>
              <Switch
                checked={inputs.demand_response.enabled}
                onCheckedChange={(c) =>
                  set('demand_response', { ...inputs.demand_response, enabled: c })
                }
                aria-label="Demand response"
              />
            </div>
            {inputs.demand_response.enabled && (
              <div className="pl-2 border-l-2 border-warning/30">
                <Slider
                  label="DR revenue"
                  value={inputs.demand_response.revenue_per_kw_yr}
                  min={2}
                  max={25}
                  step={1}
                  onChange={(v) =>
                    set('demand_response', {
                      ...inputs.demand_response,
                      revenue_per_kw_yr: v,
                    })
                  }
                  format={(v) => `$${v}/kW-yr`}
                />
                <p className="text-[10px] text-text-3 mono mt-1">
                  PJM ELRP ranges $5-15/kW-yr depending on commitment level.
                </p>
              </div>
            )}
          </Card>

          <Card className="p-3">
            <button
              type="button"
              className="w-full flex items-center justify-between text-xs font-semibold text-text-1 hover:text-accent"
              onClick={() => setShowSources((s) => !s)}
              aria-expanded={showSources}
            >
              <span className="flex items-center gap-1.5">
                <Info size={12} /> Data sources
              </span>
              {showSources ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {showSources && (
              <div className="mt-2 text-[11px] text-text-2 space-y-1.5 mono">
                <div>EIA Form 861 — US state industrial retail rates 2024</div>
                <div>Eurostat NRG_PC_205 — EU industrial rates 2024</div>
                <div>NVIDIA H100 / H200 / B200 / GB200 / A100 datasheets</div>
                <div>AMD Instinct MI300X datasheet</div>
                <div>NREL eGRID 2024 — US regional carbon factors</div>
                <div>IEA 2024 — international carbon intensity</div>
                <div>PJM Data Miner 2 — 2025-26 regulation clearing prices</div>
                <div>EIA RECS 2020 — US average household kWh / yr</div>
                <div>Hydro-Québec, Landsvirkjun, Saudi SEC industrial tariffs</div>
              </div>
            )}
          </Card>
        </div>

        {/* Outputs */}
        <div className="space-y-3">
          {/* Headline */}
          <Card className="p-5">
            <CardSubtitle>Estimated annual electricity cost</CardSubtitle>
            <motion.div
              key={outputs.annual_cost_usd}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-semibold mono tabular-nums text-text-1 mt-1"
            >
              {formatUSD(outputs.annual_cost_usd)}
            </motion.div>
            <div className="text-xs text-text-2 mt-1">
              {region?.name} · {formatCompact(inputs.num_gpus)} GPUs ·{' '}
              {formatPct(inputs.utilization)} utilization · PUE {inputs.pue.toFixed(2)}
            </div>
          </Card>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <MiniMetric
              label="Total power"
              value={`${(outputs.total_power_kw / 1000).toFixed(1)} MW`}
              icon={<Zap size={12} />}
            />
            <MiniMetric
              label="Annual energy"
              value={`${formatFixed(outputs.annual_energy_twh, 3)} TWh`}
              icon={<Server size={12} />}
            />
            <MiniMetric
              label="Monthly cost"
              value={formatUSD(outputs.monthly_cost_usd)}
            />
            <MiniMetric
              label="Per GPU / yr"
              value={formatUSD(outputs.cost_per_gpu_yr)}
            />
            <MiniMetric
              label="CO2 / yr"
              value={`${formatCompact(outputs.co2_tons_yr)} t`}
              icon={<Leaf size={12} className="text-success" />}
            />
            <MiniMetric
              label="US homes powered"
              value={formatCompact(outputs.homes_equivalent)}
            />
          </div>

          {/* Net cost reduction */}
          {(inputs.storage.enabled || inputs.demand_response.enabled) && (
            <Card className="p-4 border-accent/40">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardSubtitle>Net cost after revenue</CardSubtitle>
                  <div className="text-2xl font-semibold mono tabular-nums text-text-1 mt-0.5">
                    {formatUSD(outputs.net_cost_usd)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-2">Reduction</div>
                  <div className="text-xl font-semibold text-success mono">
                    {formatPct(reduction / 100)}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] mono text-text-2">
                {outputs.storage_revenue_usd > 0 && (
                  <div>
                    Storage{' '}
                    <span className="text-success">
                      -{formatUSD(outputs.storage_revenue_usd)}
                    </span>
                  </div>
                )}
                {outputs.dr_revenue_usd > 0 && (
                  <div>
                    DR{' '}
                    <span className="text-success">
                      -{formatUSD(outputs.dr_revenue_usd)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Region comparison chart */}
          <Card className="p-4">
            <CardTitle>Annual cost by region</CardTitle>
            <CardSubtitle>
              Same cluster spec across all regions. Selected region highlighted in
              accent blue.
            </CardSubtitle>
            <div className="h-72 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={outputs.ranking}
                  layout="vertical"
                  margin={{ left: 60, right: 56 }}
                >
                  <CartesianGrid stroke={colors.gridLine} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    stroke={colors.axisLabel}
                    fontSize={10}
                    tickFormatter={(v) => formatCompact(v as number)}
                  />
                  <YAxis
                    type="category"
                    dataKey={(d: { region: Region }) => d.region.name}
                    stroke={colors.axisLabel}
                    fontSize={10}
                    width={170}
                  />
                  <RTooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      background: colors.tooltipBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 4,
                      fontSize: 11,
                      color: '#f1f5f9',
                    }}
                    itemStyle={{ color: '#f1f5f9' }}
                    labelStyle={{ color: '#f1f5f9' }}
                    formatter={(v) => [
                      typeof v === 'number' ? formatUSD(v) : String(v),
                      'Annual cost',
                    ]}
                    labelFormatter={(_label, payload) => {
                      if (!payload || payload.length === 0) return ''
                      const r = (payload[0]!.payload as { region: Region }).region
                      return r.name
                    }}
                  />
                  <Bar dataKey="annual_cost_usd" radius={[0, 2, 2, 0]}>
                    {outputs.ranking.map((row) => (
                      <Cell
                        key={row.region.id}
                        fill={row.region.id === inputs.region ? '#2563eb' : '#475569'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Region table */}
          <Card className="p-4">
            <CardTitle>Region table</CardTitle>
            <CardSubtitle>
              Ranked cheapest first. Delta is annual savings or extra cost vs your selected region.
            </CardSubtitle>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[11px] mono">
                <thead className="text-text-3 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left py-1.5">Region</th>
                    <th className="text-right py-1.5">Rate $/kWh</th>
                    <th className="text-right py-1.5">CO2 g/kWh</th>
                    <th className="text-right py-1.5">Annual cost</th>
                    <th className="text-right py-1.5">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {outputs.ranking.map((row) => {
                    const current = row.region.id === inputs.region
                    return (
                      <tr
                        key={row.region.id}
                        className={`border-t border-border ${
                          current ? 'bg-accent/10 text-text-1' : 'text-text-2 hover:bg-surface-hover'
                        }`}
                      >
                        <td className="py-1.5">
                          <button
                            type="button"
                            className="text-left hover:text-accent"
                            onClick={() => set('region', row.region.id)}
                          >
                            {row.region.name}
                          </button>
                        </td>
                        <td className="py-1.5 text-right">{row.region.rate_per_kwh.toFixed(3)}</td>
                        <td className="py-1.5 text-right">{row.region.carbon_g_per_kwh}</td>
                        <td className="py-1.5 text-right">{formatUSD(row.annual_cost_usd)}</td>
                        <td
                          className={`py-1.5 text-right ${
                            current
                              ? 'text-text-3'
                              : row.delta_usd < 0
                                ? 'text-success'
                                : 'text-warning'
                          }`}
                        >
                          {current
                            ? '—'
                            : `${row.delta_usd >= 0 ? '+' : '-'}${formatUSD(Math.abs(row.delta_usd))}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Export */}
          <Card className="p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-text-2">
                Export current calculation for sharing or attaching to a write-up.
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadCSV(inputs, outputs)}
                >
                  <Download size={12} /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void downloadPDF(inputs, outputs)}
                >
                  <FileText size={12} /> PDF report
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-2">{label}</span>
        <span className="text-[11px] mono text-text-1">
          {format ? format(value) : value.toLocaleString()}
        </span>
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)))
        }}
        className="w-full h-8 px-2 text-xs bg-bg border border-border rounded text-text-1 focus:outline-none focus:border-accent mono"
      />
    </div>
  )
}

function MiniMetric({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-3 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold mono tabular-nums text-text-1 mt-1">
        {value}
      </div>
    </div>
  )
}

