/** Left-panel asset placement UI for the Pro simulator's optimization mode. */

import { Battery, Plus, Server, Sun, Trash2, Wind } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSimulator } from '@/store/simulator'
import { Button, Card, Slider } from '@/components/ui'
import { formatMW, formatMWh, formatPct } from '@/lib/format'
import { cn } from '@/lib/cn'

export function AssetPanel() {
  const placement = useSimulator((s) => s.placementMode)
  const setPlacement = useSimulator((s) => s.setPlacementMode)

  const batteries = useSimulator((s) => s.batteries)
  const dataCenters = useSimulator((s) => s.dataCenters)
  const renewables = useSimulator((s) => s.renewables)

  const removeBattery = useSimulator((s) => s.removeBattery)
  const removeDC = useSimulator((s) => s.removeDataCenter)
  const removeRen = useSimulator((s) => s.removeRenewable)
  const updateBattery = useSimulator((s) => s.updateBattery)
  const updateDC = useSimulator((s) => s.updateDataCenter)
  const updateRen = useSimulator((s) => s.updateRenewable)

  return (
    <div className="space-y-3 overflow-y-auto pr-1">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-text-2 mb-2">
          Place asset
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <PlaceButton
            kind="battery"
            label="Battery"
            icon={<Battery size={14} />}
            active={placement === 'battery'}
            onClick={() => setPlacement(placement === 'battery' ? null : 'battery')}
          />
          <PlaceButton
            kind="data_center"
            label="AI"
            icon={<Server size={14} />}
            active={placement === 'data_center'}
            onClick={() =>
              setPlacement(placement === 'data_center' ? null : 'data_center')
            }
          />
          <PlaceButton
            kind="renewable"
            label="Renew"
            icon={<Sun size={14} />}
            active={placement === 'renewable'}
            onClick={() => setPlacement(placement === 'renewable' ? null : 'renewable')}
          />
        </div>
        {placement && (
          <p className="text-[11px] text-accent mt-2 mono animate-fade-in">
            Click a bus to place a {placement.replace('_', ' ')}.
          </p>
        )}
      </div>

      <div className="border-t border-border" />

      {batteries.length === 0 &&
        dataCenters.length === 0 &&
        renewables.length === 0 && (
          <p className="text-[11px] text-text-2 px-1">
            No assets placed yet — add a battery, AI campus, or renewable above.
          </p>
        )}

      <AnimatePresence>
        {batteries.map((b) => (
          <motion.div
            key={b.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Battery size={14} className="text-success" />
                <span className="text-xs font-semibold text-text-1">
                  Battery · bus {b.bus}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`Remove ${b.id}`}
                  className="text-text-2 hover:text-danger transition-colors"
                  onClick={() => removeBattery(b.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Slider
                label="Energy capacity"
                unit="MWh"
                value={b.e_max_mwh}
                min={10}
                max={500}
                step={10}
                onChange={(v) =>
                  updateBattery(b.id, {
                    e_max_mwh: v,
                    initial_soc_mwh: Math.min(b.initial_soc_mwh, v),
                  })
                }
                format={(v) => formatMWh(v)}
              />
              <Slider
                label="Power rating"
                unit="MW"
                value={b.p_max_mw}
                min={5}
                max={300}
                step={5}
                onChange={(v) => updateBattery(b.id, { p_max_mw: v })}
                format={(v) => formatMW(v)}
              />
              <Slider
                label="Initial SOC"
                value={b.initial_soc_mwh}
                min={0}
                max={b.e_max_mwh}
                step={1}
                onChange={(v) => updateBattery(b.id, { initial_soc_mwh: v })}
                format={(v) => `${formatMWh(v)} (${formatPct(v / b.e_max_mwh)})`}
              />
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {dataCenters.map((d) => (
          <motion.div
            key={d.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Server size={14} className="text-purple-400" />
                <span className="text-xs font-semibold text-text-1">
                  AI Campus · bus {d.bus}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`Remove ${d.id}`}
                  className="text-text-2 hover:text-danger transition-colors"
                  onClick={() => removeDC(d.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Slider
                label="Peak compute"
                unit="MW"
                value={d.c_max_mw}
                min={50}
                max={1000}
                step={50}
                onChange={(v) => updateDC(d.id, { c_max_mw: v })}
                format={(v) => formatMW(v)}
              />
              <Slider
                label="Compute value"
                value={d.compute_value_per_mwh}
                min={20}
                max={300}
                step={5}
                onChange={(v) => updateDC(d.id, { compute_value_per_mwh: v })}
                format={(v) => `$${v}/MWh`}
              />
              <Slider
                label="Min utilization"
                value={d.flex_min}
                min={0}
                max={d.flex_max}
                step={0.05}
                onChange={(v) => updateDC(d.id, { flex_min: v })}
                format={(v) => formatPct(v)}
              />
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {renewables.map((r) => (
          <motion.div
            key={r.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {r.kind === 'wind' ? (
                  <Wind size={14} className="text-cyan-300" />
                ) : (
                  <Sun size={14} className="text-yellow-300" />
                )}
                <span className="text-xs font-semibold text-text-1 capitalize">
                  {r.kind} · bus {r.bus}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`Remove ${r.id}`}
                  className="text-text-2 hover:text-danger transition-colors"
                  onClick={() => removeRen(r.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Slider
                label="Capacity"
                unit="MW"
                value={r.capacity_mw}
                min={20}
                max={500}
                step={10}
                onChange={(v) => updateRen(r.id, { capacity_mw: v })}
                format={(v) => formatMW(v)}
              />
              <div className="text-[11px] text-text-2 mono mt-2">
                Type:{' '}
                <button
                  className="underline hover:text-text-1"
                  onClick={() =>
                    updateRen(r.id, { kind: r.kind === 'solar' ? 'wind' : 'solar' })
                  }
                >
                  {r.kind === 'solar' ? 'switch to wind' : 'switch to solar'}
                </button>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface PlaceButtonProps {
  kind: 'battery' | 'data_center' | 'renewable'
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function PlaceButton({ label, icon, active, onClick }: PlaceButtonProps) {
  return (
    <Button
      variant={active ? 'primary' : 'secondary'}
      size="sm"
      onClick={onClick}
      className={cn('flex-col h-auto py-2 gap-1', active && 'ring-2 ring-accent/40')}
    >
      <span className="flex items-center gap-1">
        <Plus size={10} /> {icon}
      </span>
      <span className="text-[10px]">{label}</span>
    </Button>
  )
}
