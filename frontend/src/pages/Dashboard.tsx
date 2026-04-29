/** Analysis dashboard — SDP policy comparison and forecast quality. */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line as RLine,
  LineChart,
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
  RefreshCw,
} from 'lucide-react'
import { api } from '@/api/client'
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
import { formatPct, formatUSD } from '@/lib/format'
import type { PolicyName } from '@/types/api'

type ForecastType = 'perfect' | 'naive' | 'xgboost'

const policyMeta: Record<PolicyName, { label: string; color: string }> = {
  perfect_foresight: { label: 'Perfect Foresight', color: '#10b981' },
  mpc: { label: 'MPC', color: '#2563eb' },
  myopic_greedy: { label: 'Myopic', color: '#f59e0b' },
}

export function Dashboard() {
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

  // Scatter: RMSE vs gap (single point per scenario; we only have one but
  // place 3 forecast tiers as a tradeoff curve)
  const scatterData = useMemo(() => {
    if (!fcQuery.data || !pf) return []
    return policies
      .filter((p) => p.policy_name !== 'perfect_foresight')
      .map((p) => ({
        name: policyMeta[p.policy_name].label,
        rmse: fcQuery.data.rmse_per_mwh,
        gap_pct: pf.total_revenue > 0
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

  const avgSolveTime = useMemo(() => {
    if (policies.length === 0) return null
    return policies.reduce((acc, p) => acc + p.solve_time_seconds, 0) / policies.length
  }, [policies])

  const isLoading = sdpQuery.isLoading || fcQuery.isLoading

  return (
    <div className="flex-1 p-6 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-1">Analysis Dashboard</h1>
          <p className="text-sm text-text-2 mt-1">
            SDP policy comparison: Perfect Foresight ≥ MPC ≥ Myopic Greedy.
            Powered by the FastAPI <code className="mono text-xs px-1.5 bg-bg rounded">/sdp/battery</code> endpoint.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success">REAL PJM (AEP-DAYTON HUB, Mar–Apr 2026)</Badge>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
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
              ]}
            />
          </div>
          <div>
            <CardSubtitle>Seed (week)</CardSubtitle>
            <Select
              value={String(seed)}
              onValueChange={(v) => setSeed(Number(v))}
              size="sm"
              options={[
                { value: '42', label: 'Week 42 — base' },
                { value: '7', label: 'Week 7 — calm' },
                { value: '11', label: 'Week 11 — volatile' },
                { value: '23', label: 'Week 23 — heatwave' },
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
          label="Optimality Gap"
          value={optimalityGap === null ? '—' : `${optimalityGap.toFixed(1)}%`}
          unit="vs PF"
          icon={<Activity size={14} />}
          loading={isLoading}
        />
        <MetricCard
          label="Forecast RMSE"
          value={
            fcQuery.data ? `${fcQuery.data.rmse_per_mwh.toFixed(3)}` : '—'
          }
          unit="$/MWh"
          icon={<Cpu size={14} />}
          loading={isLoading}
        />
        <MetricCard
          label="Avg Solve Time"
          value={avgSolveTime === null ? '—' : `${avgSolveTime.toFixed(2)}`}
          unit="s"
          icon={<Clock size={14} />}
          loading={isLoading}
        />
      </div>

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
                <LineChart data={revenueSeries}>
                  <CartesianGrid stroke="#162040" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" stroke="#64748b" fontSize={10} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickFormatter={(v) => formatUSD(v as number)}
                  />
                  <RTooltip
                    contentStyle={{
                      background: '#06080f',
                      border: '1px solid #162040',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
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
                      />
                    ),
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
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
                  <CartesianGrid stroke="#162040" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={10}
                    width={70}
                  />
                  <RTooltip
                    contentStyle={{
                      background: '#06080f',
                      border: '1px solid #162040',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Energy" stackId="a" fill="#2563eb" />
                  <Bar dataKey="Regulation" stackId="a" fill="#10b981" />
                  <Bar dataKey="Degradation" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Scatter */}
      <Card className="p-4">
        <CardTitle>Forecast RMSE vs Optimality Gap</CardTitle>
        <CardSubtitle>
          The cost of forecast error: how much revenue MPC and Myopic leave on
          the table relative to perfect foresight.
        </CardSubtitle>
        <div className="h-64 mt-3">
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="#162040" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="rmse"
                  name="Forecast RMSE"
                  unit=" $/MWh"
                  stroke="#64748b"
                  fontSize={10}
                />
                <YAxis
                  type="number"
                  dataKey="gap_pct"
                  name="Optimality gap"
                  unit="%"
                  stroke="#64748b"
                  fontSize={10}
                />
                <ZAxis type="number" dataKey="z" range={[60, 200]} />
                <RTooltip
                  contentStyle={{
                    background: '#06080f',
                    border: '1px solid #162040',
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                  formatter={(value, name) => {
                    const v = typeof value === 'number' ? value : 0
                    if (name === 'rmse') return [`${v.toFixed(3)} $/MWh`, 'RMSE']
                    if (name === 'gap_pct') return [`${v.toFixed(1)}%`, 'Gap']
                    return [String(value ?? '—'), String(name)]
                  }}
                />
                <Scatter
                  data={scatterData}
                  isAnimationActive={false}
                >
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
      </Card>

      {sdpQuery.isError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="border-danger/40">
            <p className="text-sm text-danger">
              Couldn't reach the backend. Make sure FastAPI is running on port 8000.
            </p>
          </Card>
        </motion.div>
      )}

      <p className="text-[10px] text-text-2 mono">
        Based on synthetic prices generated server-side. Toggle{' '}
        <span className="text-text-1">Forecast</span> to see how forecast quality
        changes the gap. Coverage in the report is in <code>report/IE590_final_report.md</code>.
      </p>

      {/* silence unused import for formatPct (kept for future thresholds) */}
      <span className="hidden">{formatPct(0)}</span>
    </div>
  )
}
