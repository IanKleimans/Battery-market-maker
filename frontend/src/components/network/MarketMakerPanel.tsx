/** Right-panel content for the Market-Maker mode.
 *
 * Three sub-tabs:
 *   Revenue       PT vs SA bar chart + Stackelberg Gain headline
 *   LMP impact    table of bus | LMP_PT | LMP_SA | delta with bars
 *   Methodology   KaTeX-rendered iterative best-response derivation,
 *                 with MPEC framed as honest future work
 */

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BlockMath, InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import { Card, CardSubtitle, CardTitle, Tab, TabList, TabPanel, Tabs } from '@/components/ui'
import { useThemeColors } from '@/lib/theme'
import { formatLMP, formatPct, formatUSD } from '@/lib/format'
import type { StackelbergSolution } from '@/types/api'

export function MarketMakerPanel({ result }: { result: StackelbergSolution }) {
  return (
    <Tabs defaultValue="revenue" className="h-full flex flex-col">
      <TabList className="self-start mb-3">
        <Tab value="revenue">Revenue</Tab>
        <Tab value="lmp">LMP impact</Tab>
        <Tab value="method">Methodology</Tab>
      </TabList>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <TabPanel value="revenue">
          <RevenueTab result={result} />
        </TabPanel>
        <TabPanel value="lmp">
          <LMPImpactTab result={result} />
        </TabPanel>
        <TabPanel value="method">
          <MethodologyTab result={result} />
        </TabPanel>
      </div>
    </Tabs>
  )
}

function RevenueTab({ result }: { result: StackelbergSolution }) {
  const colors = useThemeColors()
  const data = useMemo(
    () => [
      {
        name: 'Price-Taker',
        revenue: Math.round(result.price_taker_leader_revenue),
        fill: '#475569',
      },
      {
        name: 'Stackelberg',
        revenue: Math.round(result.stackelberg_leader_revenue),
        fill: '#2563eb',
      },
    ],
    [result],
  )
  const gain = result.stackelberg_gain_usd
  const sign = gain >= 0 ? '+' : ''

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <CardSubtitle>Stackelberg gain over the {result.horizon_hours}-hour horizon</CardSubtitle>
        <div
          className={`text-3xl font-semibold mono tabular-nums mt-1 ${gain >= 0 ? 'text-success' : 'text-danger'}`}
        >
          {sign}
          {formatUSD(gain)}
        </div>
        <p className="text-[11px] text-text-2 mt-1">
          Leader revenue under Stackelberg-aware dispatch minus revenue under the
          price-taker assumption. Positive means accounting for market impact pays.
        </p>
      </Card>

      <Card className="p-4">
        <CardTitle>Leader revenue comparison</CardTitle>
        <div className="h-48 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 16, right: 16, top: 8 }}>
              <XAxis dataKey="name" stroke={colors.axisLabel} fontSize={11} />
              <YAxis
                stroke={colors.axisLabel}
                fontSize={10}
                tickFormatter={(v) => formatUSD(v as number)}
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
                  'Revenue',
                ]}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-3">
        <CardSubtitle>Market power index</CardSubtitle>
        <div className="text-xl font-semibold mono tabular-nums text-text-1 mt-0.5">
          {formatPct(result.market_power_index)}
        </div>
        <p className="text-[11px] text-text-2 mt-1">
          Approximate fraction of total system cost moved by the leader's strategy
          choice. Above 5% suggests the price-taker assumption is breaking down at
          this asset size.
        </p>
      </Card>
    </div>
  )
}

function LMPImpactTab({ result }: { result: StackelbergSolution }) {
  const sorted = useMemo(
    () => [...result.bus_impacts].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    [result],
  )
  const maxAbs = Math.max(
    1e-3,
    ...sorted.map((b) => Math.abs(b.delta)),
  )

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <CardSubtitle>Largest absolute LMP shift across all (bus, hour) pairs</CardSubtitle>
        <div className="text-xl font-semibold mono tabular-nums text-text-1 mt-0.5">
          {formatLMP(result.max_lmp_impact_usd_per_mwh)}
        </div>
      </Card>

      <Card className="p-3">
        <CardTitle>Bus-by-bus LMP shift</CardTitle>
        <CardSubtitle>
          Time-averaged LMPs under each strategy. Bars show |delta| relative to the
          largest shift. The leader is on bus {result.leader_bus}.
        </CardSubtitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px] mono">
            <thead className="text-text-3 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-1.5">Bus</th>
                <th className="text-right py-1.5">PT</th>
                <th className="text-right py-1.5">SA</th>
                <th className="text-right py-1.5">Δ</th>
                <th className="py-1.5 w-32">Magnitude</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => {
                const isLeader = b.bus === result.leader_bus
                const widthPct = (Math.abs(b.delta) / maxAbs) * 100
                return (
                  <tr
                    key={b.bus}
                    className={`border-t border-border ${isLeader ? 'bg-accent/10' : ''}`}
                  >
                    <td className="py-1.5">
                      <span className={isLeader ? 'text-accent font-semibold' : 'text-text-1'}>
                        {b.name}
                      </span>
                      {isLeader && (
                        <span className="ml-1 text-[9px] text-accent">leader</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-text-2">{formatLMP(b.lmp_price_taker)}</td>
                    <td className="py-1.5 text-right text-text-1">{formatLMP(b.lmp_stackelberg_aware)}</td>
                    <td
                      className={`py-1.5 text-right ${
                        b.delta > 0
                          ? 'text-warning'
                          : b.delta < 0
                            ? 'text-success'
                            : 'text-text-2'
                      }`}
                    >
                      {b.delta >= 0 ? '+' : ''}
                      {formatLMP(b.delta)}
                    </td>
                    <td className="py-1.5">
                      <div className="h-1.5 bg-border rounded">
                        <div
                          className={`h-full rounded ${
                            b.delta > 0 ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function MethodologyTab({ result }: { result: StackelbergSolution }) {
  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3 text-[11px] text-text-2">
        <CardTitle>Iterative best-response (shipped)</CardTitle>
        <p>
          We compare two regimes for the campus's dispatch decision:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <span className="text-text-1">Price-taker.</span> The campus assumes
            its own dispatch does not move LMPs. It optimizes against the LMPs
            it would see if it were not on the grid, then the ISO re-clears with
            that dispatch fixed in place.
          </li>
          <li>
            <span className="text-text-1">Stackelberg-aware.</span> The campus
            accounts for its own market impact via the LP-equivalent equilibrium,
            solved as the joint multi-period DC-OPF.
          </li>
        </ul>
        <p>
          The campus's per-period decision under price-taking reduces to the
          threshold rule:
        </p>
        <BlockMath math="u_{\text{PT}}(t) \;=\; \begin{cases} \text{flex}_{\max} & v > \lambda^{(0)}_t \\ \text{flex}_{\min} & v \le \lambda^{(0)}_t \end{cases}" />
        <p>
          where <InlineMath math="v" /> is the campus's compute valuation
          (<span className="mono">$/MWh</span>) and{' '}
          <InlineMath math="\lambda^{(0)}_t" /> is the exogenous LMP at the
          leader's bus from the no-leader solve.
        </p>
        <p>
          The <span className="text-text-1">Stackelberg gain</span> is then{' '}
          <InlineMath math="G \;=\; R_{\text{SA}} - R_{\text{PT}}" />, where each{' '}
          <InlineMath math="R" /> is the leader's compute revenue minus
          electricity cost integrated over the horizon.
        </p>
        <p>
          For the LP form used in this project the iterative best-response
          converges in two passes (price-taker then joint solve), so we report
          two iterations explicitly. With{' '}
          <InlineMath math={`\\lvert\\Delta\\lambda\\rvert_{\\max} = ${result.max_lmp_impact_usd_per_mwh.toFixed(2)}`} />
          {' '}<span className="mono">$/MWh</span>, the algorithm{' '}
          <span className={result.converged ? 'text-success' : 'text-warning'}>
            {result.converged ? 'converged' : 'did not fully converge'}
          </span>{' '}within the iteration budget.
        </p>
      </Card>

      <Card className="p-4 space-y-2 text-[11px] text-text-2">
        <CardTitle>MPEC reformulation (future work)</CardTitle>
        <p>
          The natural research extension is a true Mathematical Program with
          Equilibrium Constraints, folding the inner ISO LP's KKT conditions
          into the leader's program:
        </p>
        <BlockMath math="\min_{u} \;-\; v \cdot u + p^\top g(u) \quad \text{s.t.} \;\; \text{KKT}(\text{ISO LP}(u))" />
        <p>
          This is single-shot rather than iterative, but in cvxpy the
          complementarity constraints become numerically fragile at the network
          sizes we exercise here. For empirical work at the IEEE 14-bus / 24-hour
          scale, the iterative scheme above is the right choice. The MPEC form
          is the principled next step, especially when extended to the Stackelberg
          Markov game setting of Liu et al. (2025) for adaptive followers under
          stochastic ISO behavior.
        </p>
      </Card>
    </div>
  )
}
