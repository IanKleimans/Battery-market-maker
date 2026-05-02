/** Analysis dashboard — SDP policy comparison and forecast quality. */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Legend,
  Line as RLine,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { motion } from 'framer-motion'
import {
  Activity,
  Clock,
  Cpu,
  DollarSign,
  Info,
  RefreshCw,
} from 'lucide-react'
import { api } from '@/api/client'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useThemeColors } from '@/lib/theme'
import {
  Badge,
  Button,
  Card,
  CardSubtitle,
  CardTitle,
  MetricCard,
  Select,
  Skeleton,
} from '@/components/ui'
import { formatFixed, formatPct, formatSeconds, formatUSD } from '@/lib/format'
import { ChartCalculations } from '@/components/dashboard/ChartCalculations'
import type { PolicyName } from '@/types/api'

type ForecastType = 'perfect' | 'naive' | 'xgboost'

const policyMeta: Record<PolicyName, { label: string; color: string }> = {
  perfect_foresight: { label: 'Perfect Foresight', color: '#10b981' },
  mpc: { label: 'MPC', color: '#2563eb' },
  myopic_greedy: { label: 'Myopic', color: '#f59e0b' },
}

/** Test windows the user can flip between. Each maps to a deterministic seed
 * passed to the backend's synthetic price generator, so each window is
 * reproducible across visits. */
const TEST_WINDOWS: Array<{ value: number; label: string; description: string }> = [
  { value: 42, label: 'Window A · base', description: 'Mid-volatility baseline (default)' },
  { value: 7, label: 'Window B · calm', description: 'Flat overnight prices, narrow spread' },
  { value: 11, label: 'Window C · volatile', description: 'Wide spread, multiple price spikes' },
  { value: 23, label: 'Window D · heatwave', description: 'Sustained high afternoon prices' },
  { value: 91, label: 'Window E · negative', description: 'Renewables crash prices into the negatives' },
  { value: 137, label: 'Window F · congestion', description: 'Long binding-line periods' },
]

export function Dashboard() {
  usePageMeta({
    title: 'Dashboard',
    description:
      'Compare Perfect Foresight, MPC, and Myopic battery dispatch policies on a synthetic test window.',
  })
  const colors = useThemeColors()
  const [seed, setSeed] = useState(42)
  const [forecast, setForecast] = useState<ForecastType>('xgboost')
  const [horizon, setHorizon] = useState(24)

  const sdpQuery = useQuery({
    queryKey: ['sdp', seed, forecast, horizon],
    queryFn: () =>
      api.sdpBattery({
        policies: ['perfect_foresight', 'mpc', 'myopic_greedy'],
        horizon_hours: horizon,
        timestep_minutes: 60,
        mpc_horizon_hours: 4,
        forecast,
        seed,
      }),
  })

  const fcQuery = useQuery({
    queryKey: ['forecast-quality', forecast, seed, horizon],
    queryFn: () =>
      api.forecastQuality({
        forecast_type: forecast,
        horizon_hours: horizon,
        n_samples: 500,
        seed,
      }),
  })

  const policies = sdpQuery.data?.policies ?? []
  const pf = policies.find((p) => p.policy_name === 'perfect_foresight')
  const mpc = policies.find((p) => p.policy_name === 'mpc')
  const myopic = policies.find((p) => p.policy_name === 'myopic_greedy')

  // Cumulative revenue per policy
  const revenueSeries = useMemo(() => {
    if (!sdpQuery.data) return []
    const t = sdpQuery.data.timestamps
    const series: Array<Record<string, number | string>> = []
    const cumulative: Record<string, number> = {}
    for (const p of policies) cumulative[p.policy_name] = 0
    for (let i = 0; i < t.length; i++) {
      const row: Record<string, number | string> = { hour: i }
      for (const p of policies) {
        const dt = 1
        const energy =
          (p.schedule_lmp[i] ?? 0) *
          ((p.schedule_discharge_mw[i] ?? 0) - (p.schedule_charge_mw[i] ?? 0)) *
          dt
        cumulative[p.policy_name] = (cumulative[p.policy_name] ?? 0) + energy
        row[p.policy_name] = cumulative[p.policy_name] ?? 0
      }
      series.push(row)
    }
    return series
  }, [sdpQuery.data, policies])

  // Decomposition bars
  const decompositionData = useMemo(() => {
    return policies.map((p) => ({
      name: policyMeta[p.policy_name].label,
      Energy: Math.round(p.energy_revenue),
      Regulation: Math.round(p.regulation_revenue),
      Degradation: -Math.round(p.degradation_cost),
    }))
  }, [policies])

  // Scatter: RMSE vs gap. One point per (forecaster x policy) pair, plus
  // anchor reference points for Perfect Foresight (0, 0) and Myopic baseline.
  const scatterData = useMemo(() => {
    if (!fcQuery.data || !pf) return []
    return policies
      .filter((p) => p.policy_name !== 'perfect_foresight')
      .map((p) => ({
        name: policyMeta[p.policy_name].label,
        rmse: fcQuery.data.rmse_per_mwh,
        gap_pct:
          pf.total_revenue > 0
            ? ((pf.total_revenue - p.total_revenue) / pf.total_revenue) * 100
            : 0,
        z: p.solve_time_seconds,
      }))
  }, [fcQuery.data, policies, pf])

  const optimalityGap = useMemo(() => {
    if (!pf || !mpc) return null
    if (pf.total_revenue <= 0) return 0
    return ((pf.total_revenue - mpc.total_revenue) / pf.total_revenue) * 100
  }, [pf, mpc])

  const myopicGap = useMemo(() => {
    if (!pf || !myopic) return null
    if (pf.total_revenue <= 0) return 0
    return ((pf.total_revenue - myopic.total_revenue) / pf.total_revenue) * 100
  }, [pf, myopic])

  const avgSolveTime = useMemo(() => {
    if (policies.length === 0) return null
    return policies.reduce((acc, p) => acc + p.solve_time_seconds, 0) / policies.length
  }, [policies])

  const totalRevenueZero =
    !!pf && pf.total_revenue <= 1 && (mpc?.total_revenue ?? 0) <= 1

  const isLoading = sdpQuery.isLoading || fcQuery.isLoading
  const hasData = !!sdpQuery.data && policies.length > 0

  // Final cumulative value per policy, for the right-edge annotations.
  const finals = useMemo(() => {
    if (revenueSeries.length === 0) return {} as Record<string, number>
    const last = revenueSeries[revenueSeries.length - 1]!
    const out: Record<string, number> = {}
    for (const p of policies) {
      const v = last[p.policy_name]
      out[p.policy_name] = typeof v === 'number' ? v : 0
    }
    return out
  }, [revenueSeries, policies])

  const windowDescription = TEST_WINDOWS.find((w) => w.value === seed)?.description

  return (
    <div className="flex-1 p-6 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-1">Analysis Dashboard</h1>
          <p className="text-sm text-text-2 mt-1">
            Perfect Foresight ≥ MPC ≥ Myopic Greedy on a synthetic price window.
            Backed by <code className="mono text-xs px-1.5 bg-bg rounded">/sdp/battery</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="warning">SYNTHETIC PRICES</Badge>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <CardSubtitle>Test window</CardSubtitle>
            <Select
              value={String(seed)}
              onValueChange={(v) => setSeed(Number(v))}
              size="sm"
              options={TEST_WINDOWS.map((w) => ({
                value: String(w.value),
                label: w.label,
                description: w.description,
              }))}
            />
          </div>
          <div>
            <CardSubtitle>Forecast</CardSubtitle>
            <Select
              value={forecast}
              onValueChange={(v) => setForecast(v as ForecastType)}
              size="sm"
              options={[
                { value: 'perfect', label: 'Perfect Foresight' },
                { value: 'xgboost', label: 'XGBoost' },
                { value: 'naive', label: 'Naive Persistence' },
              ]}
            />
          </div>
          <div>
            <CardSubtitle>Horizon</CardSubtitle>
            <Select
              value={String(horizon)}
              onValueChange={(v) => setHorizon(Number(v))}
              size="sm"
              options={[
                { value: '24', label: '1 day' },
                { value: '48', label: '2 days' },
                { value: '72', label: '3 days' },
                { value: '168', label: '7 days' },
              ]}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => sdpQuery.refetch()}
            loading={sdpQuery.isFetching}
            className="ml-auto"
          >
            <RefreshCw size={14} /> Refetch
          </Button>
        </div>
        {windowDescription && (
          <p className="text-[11px] text-text-2 mono mt-2 flex items-center gap-1.5">
            <Info size={11} className="text-accent" />
            {windowDescription}
          </p>
        )}
      </Card>

      {/* Metric row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Total Revenue (PF)"
          value={pf ? formatUSD(pf.total_revenue) : '—'}
          unit="USD"
          icon={<DollarSign size={14} />}
          loading={isLoading}
        />
        <MetricCard
          label="MPC Optimality Gap"
          value={optimalityGap === null ? '—' : `${formatFixed(optimalityGap, 1)}%`}
          unit="vs PF"
          icon={<Activity size={14} />}
          loading={isLoading}
          delta={
            optimalityGap !== null && myopicGap !== null
              ? { value: myopicGap - optimalityGap, label: 'vs Myopic' }
              : undefined
          }
        />
        <MetricCard
          label="Forecast RMSE"
          value={fcQuery.data ? formatFixed(fcQuery.data.rmse_per_mwh, 3) : '—'}
          unit="$/MWh"
          icon={<Cpu size={14} />}
          loading={isLoading}
        />
        <MetricCard
          label="Avg Solve Time"
          value={avgSolveTime === null ? '—' : formatSeconds(avgSolveTime)}
          icon={<Clock size={14} />}
          loading={isLoading}
        />
      </div>

      {/* Empty state when this window genuinely had no arbitrage */}
      {hasData && totalRevenueZero && (
        <Card className="p-4 border-warning/40">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-warning shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-text-1">
                No profitable arbitrage in this window
              </h3>
              <p className="text-xs text-text-2 mt-1">
                Every policy in this window finds the spread between charge-cheap and
                discharge-expensive hours too thin to justify cycling, so total revenue is
                zero or negative after degradation. Pick a more volatile window above to
                see the policy comparison.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue line — wider */}
        <Card className="lg:col-span-2 p-4">
          <CardTitle>Cumulative Revenue Over Horizon</CardTitle>
          <CardSubtitle>
            Energy revenue accumulated through the {horizon}-hour test window. Higher = better.
          </CardSubtitle>
          <div className="h-72 mt-3">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries} margin={{ right: 100, top: 10 }}>
                  <CartesianGrid stroke={colors.gridLine} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    stroke={colors.axisLabel}
                    fontSize={10}
                    label={{
                      value: 'Hour',
                      position: 'insideBottom',
                      offset: -2,
                      style: { fontSize: 10, fill: colors.axisLabel },
                    }}
                  />
                  <YAxis
                    stroke={colors.axisLabel}
                    fontSize={10}
                    tickFormatter={(v) => formatUSD(v as number)}
                  />
                  <RTooltip
                    cursor={{ stroke: colors.accent, strokeWidth: 1, strokeDasharray: '3 3' }}
                    contentStyle={{
                      background: colors.tooltipBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 4,
                      fontSize: 11,
                      color: '#f1f5f9',
                    }}
                    itemStyle={{ color: '#f1f5f9' }}
                    labelStyle={{ color: '#f1f5f9' }}
                    labelFormatter={(label) => `Hour ${label}`}
                    formatter={(v, name) => [
                      typeof v === 'number' ? formatUSD(v, true) : String(v ?? '—'),
                      policyMeta[name as PolicyName]?.label ?? String(name),
                    ]}
                  />
                  <Legend
                    formatter={(v) => policyMeta[v as PolicyName]?.label ?? v}
                  />
                  {(['perfect_foresight', 'mpc', 'myopic_greedy'] as PolicyName[]).map(
                    (p) => (
                      <RLine
                        key={p}
                        type="monotone"
                        dataKey={p}
                        stroke={policyMeta[p].color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      >
                        {/* Final-value label at the rightmost point only */}
                        <LabelList
                          dataKey={p}
                          position="right"
                          fontSize={10}
                          fill={policyMeta[p].color}
                          fontFamily="IBM Plex Mono"
                          content={((rawProps: unknown) => {
                            const props = rawProps as {
                              x?: number | string
                              y?: number | string
                              index?: number
                              value?: number | string
                            }
                            if (props.index !== revenueSeries.length - 1) return null
                            const v = props.value
                            if (typeof v !== 'number') return null
                            const x = typeof props.x === 'number' ? props.x : Number(props.x ?? 0)
                            const y = typeof props.y === 'number' ? props.y : Number(props.y ?? 0)
                            return (
                              <text
                                x={x + 6}
                                y={y + 3}
                                fill={policyMeta[p].color}
                                fontSize={10}
                                fontFamily="IBM Plex Mono"
                                fontWeight={600}
                              >
                                {formatUSD(v)}
                              </text>
                            )
                          }) as never}
                        />
                      </RLine>
                    ),
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <ChartCalculations
            title="Cumulative revenue formula"
            formula="\text{CumRev}_\pi(T) = \sum_{t=0}^{T} \text{LMP}_t \cdot \bigl(d_{\pi,t} - c_{\pi,t}\bigr) \cdot \Delta t"
            variables={[
              { symbol: '\\pi', meaning: 'policy (Perfect Foresight, MPC, or Myopic)' },
              { symbol: '\\text{LMP}_t', meaning: 'realized hourly LMP from the test window' },
              { symbol: 'd_{\\pi,t},\\, c_{\\pi,t}', meaning: 'discharge / charge MW under policy π at hour t' },
              { symbol: '\\Delta t', meaning: '1 hour timestep' },
            ]}
            notes={`Each line tracks how much revenue the policy has banked at every hour of the horizon. PF (final ${formatUSD(finals.perfect_foresight ?? 0)}) is the achievable upper bound; MPC and Myopic gaps quantify the cost of imperfect foresight.`}
            source="Backend SDP runner /sdp/battery on synthetic prices (seeded for reproducibility)."
          />
        </Card>

        {/* Decomposition bar */}
        <Card className="p-4">
          <CardTitle>Revenue Decomposition</CardTitle>
          <CardSubtitle>
            Energy + regulation − degradation, in USD over the test window.
          </CardSubtitle>
          <div className="h-72 mt-3">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={decompositionData} layout="vertical">
                  <CartesianGrid stroke={colors.gridLine} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    stroke={colors.axisLabel}
                    fontSize={10}
                    tickFormatter={(v) => formatUSD(v as number)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={colors.axisLabel}
                    fontSize={10}
                    width={100}
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
                    formatter={(v, name) => [
                      typeof v === 'number' ? formatUSD(v) : String(v ?? '—'),
                      String(name),
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="Energy" stackId="a" fill="#2563eb" />
                  <Bar dataKey="Regulation" stackId="a" fill="#10b981" />
                  <Bar dataKey="Degradation" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <ChartCalculations
            title="Per-component revenue"
            formula="R_\pi = \underbrace{\sum_t \text{LMP}_t (d_{\pi,t} - c_{\pi,t}) \Delta t}_{\text{energy}} + \underbrace{\sum_t r_t \cdot \beta_t}_{\text{reg}} - \underbrace{\sum_t \kappa (c_{\pi,t} + d_{\pi,t}) \Delta t}_{\text{degradation}}"
            variables={[
              { symbol: 'r_t', meaning: 'PJM regulation capacity clearing price ($/MW-hr)' },
              { symbol: '\\beta_t', meaning: 'capacity offered to regulation at hour t' },
              { symbol: '\\kappa', meaning: 'battery degradation cost ($/MWh of throughput)' },
            ]}
            notes="Bars sum the per-hour contribution of each revenue stream over the full test window. Negative degradation eats into the energy + regulation total."
            source="Backend revenue breakdown returned by /sdp/battery."
          />
        </Card>
      </div>

      {/* Scatter */}
      <Card className="p-4">
        <CardTitle>Forecast RMSE vs Optimality Gap</CardTitle>
        <CardSubtitle>
          The cost of forecast error: how much revenue MPC and Myopic leave on the table
          relative to perfect foresight. Lower-left is better.
        </CardSubtitle>
        <div className="h-64 mt-3">
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
                <CartesianGrid stroke={colors.gridLine} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="rmse"
                  name="Forecast RMSE"
                  unit=" $/MWh"
                  stroke={colors.axisLabel}
                  fontSize={10}
                  domain={[0, 'auto']}
                >
                  <Label
                    value="RMSE ($/MWh)"
                    position="insideBottom"
                    offset={-4}
                    style={{ fontSize: 10, fill: colors.axisLabel }}
                  />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="gap_pct"
                  name="Optimality gap"
                  unit="%"
                  stroke={colors.axisLabel}
                  fontSize={10}
                  domain={[0, 'auto']}
                >
                  <Label
                    value="Gap (%)"
                    angle={-90}
                    position="insideLeft"
                    style={{ fontSize: 10, fill: colors.axisLabel }}
                  />
                </YAxis>
                <ZAxis type="number" dataKey="z" range={[80, 220]} />
                <RTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    background: colors.tooltipBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 4,
                    fontSize: 11,
                    color: '#f1f5f9',
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(value, name) => {
                    const v = typeof value === 'number' ? value : 0
                    if (name === 'rmse') return [`${formatFixed(v, 3)} $/MWh`, 'RMSE']
                    if (name === 'gap_pct') return [`${formatFixed(v, 1)}%`, 'Gap']
                    return [String(value ?? '—'), String(name)]
                  }}
                />
                {/* Reference line at gap = 0 (Perfect Foresight) */}
                <ReferenceLine
                  y={0}
                  stroke={policyMeta.perfect_foresight.color}
                  strokeDasharray="3 3"
                  label={{
                    value: 'Perfect Foresight',
                    position: 'insideTopLeft',
                    fontSize: 9,
                    fill: policyMeta.perfect_foresight.color,
                  }}
                />
                {/* Reference dot at the origin */}
                <ReferenceDot
                  x={0}
                  y={0}
                  r={4}
                  fill={policyMeta.perfect_foresight.color}
                  stroke="none"
                />
                <Scatter data={scatterData} isAnimationActive={false}>
                  {scatterData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.name === 'MPC'
                          ? policyMeta.mpc.color
                          : policyMeta.myopic_greedy.color
                      }
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
        <ChartCalculations
          title="RMSE vs optimality gap"
          formula="\text{RMSE} = \sqrt{\frac{1}{N}\sum_{t=1}^{N}(\hat{p}_t - p_t)^2} \quad\quad \text{Gap}_\pi = \frac{R_{\text{PF}} - R_\pi}{R_{\text{PF}}} \times 100\%"
          variables={[
            { symbol: '\\hat{p}_t', meaning: 'forecasted LMP at hour t' },
            { symbol: 'p_t', meaning: 'realized LMP at hour t' },
            { symbol: 'R_{\\text{PF}}', meaning: 'revenue under perfect foresight (upper bound)' },
            { symbol: 'R_\\pi', meaning: 'revenue under policy π using forecast quality at this point' },
          ]}
          notes="The (0, 0%) reference dot is the theoretical perfect-information limit. Points up and to the right reflect the cost of forecast error. The trend gives an empirical price-of-information curve for this asset on this window."
          source="Backend /forecasting/quality and /sdp/battery on the synthetic price corpus."
        />
      </Card>

      {sdpQuery.isError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-danger/40 p-3">
            <p className="text-sm text-danger">
              Couldn't reach the backend. Check the API health badge in the footer or
              wait 10-15 seconds for Railway to cold-start, then click Refetch above.
            </p>
          </Card>
        </motion.div>
      )}

      <p className="text-[10px] text-text-2 mono">
        Synthetic prices generated server-side; each test window is reproducible from
        its seed. Toggle <span className="text-text-1">Forecast</span> to see how
        forecast quality changes the gap. Coverage in the report is in{' '}
        <code>report/IE590_final_report.md</code>.
      </p>

      {/* silence unused import for formatPct (kept for future thresholds) */}
      <span className="hidden">{formatPct(0)}</span>
    </div>
  )
}
