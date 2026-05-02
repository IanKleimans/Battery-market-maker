/** "Show calculations" card for Live mode.
 *
 * Surfaces the math behind the current single-period dispatch:
 *   - Objective per hour (sum of generator marginal costs × dispatch)
 *   - Active generators sorted by merit order
 *   - Binding line constraints
 *   - LMP decomposition at the hovered/selected bus
 *   - 1 MW load sensitivity at that bus
 *
 * No KaTeX here — text-rendered equations re-render fast enough on slider
 * drags. The drawer in Optimization mode uses KaTeX where math is denser. */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Cpu, Zap } from 'lucide-react'
import { Card } from '@/components/ui'
import {
  bindingLinesAt,
  lmpDecomposition,
  meritOrderDispatch,
  objectiveValuePerHour,
} from '@/lib/calculations'
import { formatLMP, formatMW, formatPct, formatUSD } from '@/lib/format'
import { FUEL_COLORS } from '@/lib/colors'
import type { NetworkData, SinglePeriodSolution } from '@/types/api'

export interface LiveCalculationsProps {
  network: NetworkData
  result: SinglePeriodSolution | null
  selectedBus: number | null
}

export function LiveCalculations({ network, result, selectedBus }: LiveCalculationsProps) {
  const [open, setOpen] = useState(false)

  const dispatched = useMemo(
    () => (result ? meritOrderDispatch(network, result.generator_output) : []),
    [network, result],
  )
  const objective = useMemo(() => objectiveValuePerHour(dispatched), [dispatched])
  const binding = useMemo(
    () =>
      result
        ? bindingLinesAt(network, result.line_flow, result.line_utilization)
        : [],
    [network, result],
  )
  const decomp = useMemo(
    () =>
      result && selectedBus !== null
        ? lmpDecomposition(network, result.bus_lmp, selectedBus)
        : null,
    [network, result, selectedBus],
  )

  const active = dispatched.filter((d) => d.output_mw > 0.01)

  if (!result) return null

  return (
    <Card className="p-3">
      <button
        type="button"
        className="w-full flex items-center justify-between text-xs font-semibold text-text-1 hover:text-accent transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <Cpu size={12} /> Calculations
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-[11px] mono text-text-2">
          <Section title="Objective">
            <div>
              min Σ<sub>g</sub> c<sub>g</sub> · P<sub>g</sub>{' '}
              <span className="text-text-1">= {formatUSD(objective)} / h</span>
            </div>
            <div className="text-text-3 mt-0.5">
              {active.length} generator{active.length === 1 ? '' : 's'} dispatched of{' '}
              {network.generators.length}
            </div>
          </Section>

          <Section title="Merit order">
            <div className="space-y-1">
              {dispatched.slice(0, 8).map((d) => {
                const fuelColor = FUEL_COLORS[d.gen.fuel]
                const idle = d.output_mw < 0.01
                return (
                  <div
                    key={d.gen.id}
                    className={`flex items-center gap-2 ${idle ? 'opacity-50' : ''}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: fuelColor }}
                    />
                    <span className="w-12 truncate text-text-1">{d.gen.name}</span>
                    <span className="w-16 text-text-2">
                      ${d.gen.cost_per_mwh}/MWh
                    </span>
                    <span className="flex-1 text-right text-text-1">
                      {idle ? '— idle' : `${formatMW(d.output_mw)} (${formatPct(d.utilization)})`}
                    </span>
                  </div>
                )
              })}
              {dispatched.length > 8 && (
                <div className="text-text-3">+ {dispatched.length - 8} more</div>
              )}
            </div>
          </Section>

          <Section title="Binding constraints">
            {binding.length === 0 ? (
              <div className="text-text-3">No lines at thermal limit.</div>
            ) : (
              <div className="space-y-1">
                {binding.map((b) => (
                  <div key={b.line_id} className="flex items-center gap-2">
                    <Zap size={10} className="text-warning shrink-0" />
                    <span className="w-20 truncate text-text-1">{b.name}</span>
                    <span className="flex-1 text-right text-warning">
                      {formatPct(b.utilization)} of {formatMW(b.capacity_mw)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {selectedBus !== null && decomp && (
            <Section title={`LMP at bus ${selectedBus}`}>
              <div className="space-y-0.5">
                <Row label="Energy (slack)" value={formatLMP(decomp.energy)} />
                <Row
                  label="Congestion"
                  value={formatLMP(decomp.congestion)}
                  emphasis={Math.abs(decomp.congestion) > 0.01}
                />
                <div className="border-t border-border my-1" />
                <Row label="LMP total" value={formatLMP(decomp.total)} bold />
                <div className="text-text-3 mt-1.5">
                  +1 MW load here ⇒ +{formatUSD(decomp.total)}/h system cost
                </div>
              </div>
            </Section>
          )}
        </div>
      )}
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1">
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  emphasis,
}: {
  label: string
  value: string
  bold?: boolean
  emphasis?: boolean
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className="text-text-2">{label}</span>
      <span className={`text-text-1 tabular-nums ${emphasis ? 'text-warning' : ''}`}>
        {value}
      </span>
    </div>
  )
}
