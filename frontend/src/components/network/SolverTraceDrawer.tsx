/** "Solver trace" side drawer for the Optimization mode.
 *
 * Slides in from the right via Radix Dialog, with three sections:
 *   - Problem statistics (variables, constraints, solver, wall time, status)
 *   - Objective decomposition (fuel, battery, data center, renewable)
 *   - Binding constraints across the horizon (which lines bound the dispatch)
 *
 * Math is rendered with KaTeX since equations are denser here and don't
 * recompute as the user drags. */

import { useMemo } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { X, Cpu, Zap, FileText } from 'lucide-react'
import { BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import {
  bindingLinesHorizon,
  objectiveDecomposition,
  problemStats,
} from '@/lib/calculations'
import { formatPct, formatSeconds, formatUSD } from '@/lib/format'
import type { MultiPeriodSolution, NetworkData } from '@/types/api'

export interface SolverTraceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: MultiPeriodSolution
  network: NetworkData
}

export function SolverTraceDrawer({
  open,
  onOpenChange,
  result,
  network,
}: SolverTraceDrawerProps) {
  const stats = useMemo(() => problemStats(result), [result])
  const decomp = useMemo(() => objectiveDecomposition(result), [result])
  const binding = useMemo(
    () => bindingLinesHorizon(network, result.line_flows),
    [network, result.line_flows],
  )

  const statusBadge =
    stats.status === 'optimal'
      ? { label: 'Optimal', tone: 'text-success' }
      : stats.status === 'optimal_inaccurate'
        ? { label: 'Optimal (inaccurate)', tone: 'text-warning' }
        : { label: 'Infeasible', tone: 'text-danger' }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" />
        <RadixDialog.Content
          className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-surface border-l border-border shadow-card-hover overflow-y-auto animate-slide-in-right focus-visible:outline-none"
        >
          <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-accent" />
              <RadixDialog.Title className="text-sm font-semibold text-text-1">
                Solver trace
              </RadixDialog.Title>
            </div>
            <RadixDialog.Close
              aria-label="Close"
              className="p-1 rounded text-text-2 hover:text-text-1 hover:bg-surface-hover"
            >
              <X size={16} />
            </RadixDialog.Close>
          </div>

          <div className="p-4 space-y-5">
            {/* Problem statistics */}
            <Section icon={<Cpu size={12} />} title="Problem statistics">
              <Grid>
                <Stat label="Solver" value={stats.solver} />
                <Stat label="Status" value={statusBadge.label} tone={statusBadge.tone} />
                <Stat label="Variables" value={stats.n_variables.toLocaleString()} />
                <Stat label="Constraints" value={stats.n_constraints.toLocaleString()} />
                <Stat
                  label="Wall time"
                  value={formatSeconds(stats.solve_time_seconds, 3)}
                />
                <Stat label="Timesteps" value={String(result.n_timesteps)} />
              </Grid>
            </Section>

            {/* Objective decomposition */}
            <Section title="Objective decomposition">
              <p className="text-[11px] text-text-2 mb-2">
                Total system cost over the {result.horizon_hours} h horizon, split by source.
              </p>
              <BlockMath math="\min \;\; \sum_{t} \left[ \sum_g c_g P_{g,t} \Delta t + \sum_b \kappa_b (c_{b,t} + d_{b,t}) \Delta t - \sum_j v_j u_{j,t} c_j \Delta t + \cdots \right]" />
              <Grid className="mt-3">
                <Stat label="Fuel cost" value={formatUSD(decomp.fuel_cost)} />
                <Stat
                  label="Battery degradation"
                  value={formatUSD(decomp.battery_degradation)}
                />
                <Stat
                  label="Battery energy revenue"
                  value={formatUSD(decomp.battery_energy_revenue)}
                  tone="text-success"
                />
                <Stat
                  label="DC compute revenue"
                  value={formatUSD(decomp.data_center_compute_revenue)}
                  tone="text-success"
                />
                <Stat
                  label="DC SLA penalty"
                  value={formatUSD(decomp.data_center_sla_penalty)}
                  tone="text-warning"
                />
                <Stat
                  label="Renewable revenue"
                  value={formatUSD(decomp.renewable_energy_revenue)}
                  tone="text-success"
                />
              </Grid>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-text-2">Total</span>
                <span className="font-semibold text-text-1 mono">
                  {formatUSD(decomp.total)}
                </span>
              </div>
            </Section>

            {/* Binding constraints */}
            <Section icon={<Zap size={12} />} title="Binding constraints">
              <p className="text-[11px] text-text-2 mb-2">
                Lines that bound the dispatch at one or more timesteps. Dual value of a
                binding line is the marginal value of relaxing capacity by 1 MW.
              </p>
              {binding.length === 0 ? (
                <div className="text-[11px] text-text-3 mono">
                  No lines reached their thermal limit.
                </div>
              ) : (
                <div className="space-y-1">
                  {binding.slice(0, 12).map((b) => (
                    <div
                      key={b.line_id}
                      className="flex items-center gap-2 text-[11px] mono"
                    >
                      <Zap size={10} className="text-warning shrink-0" />
                      <span className="w-24 truncate text-text-1">{b.name}</span>
                      <span className="text-text-2">
                        {b.binding_steps} / {result.n_timesteps} h binding
                      </span>
                      <span className="flex-1 text-right text-warning">
                        peak {formatPct(b.peak_utilization)}
                      </span>
                    </div>
                  ))}
                  {binding.length > 12 && (
                    <div className="text-[11px] text-text-3 mono">
                      + {binding.length - 12} more
                    </div>
                  )}
                </div>
              )}
            </Section>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-text-1 mb-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Grid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-2 gap-2 text-[11px] mono ${className ?? ''}`}>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="bg-bg/50 rounded p-2 border border-border">
      <div className="text-[10px] text-text-3 uppercase tracking-wider">{label}</div>
      <div className={`mt-0.5 tabular-nums ${tone ?? 'text-text-1'}`}>{value}</div>
    </div>
  )
}
