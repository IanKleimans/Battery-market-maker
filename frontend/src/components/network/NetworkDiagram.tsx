/** Pure-React SVG bus diagram.
 *
 * Renders a NetworkData topology with optional per-timestep state overlays:
 * line flows, LMP coloring, generator dispatch sizing, asset icons, and
 * placement-mode bus highlighting.
 *
 * D3 is used only for math (scales, color ramps) — DOM updates go through
 * React so animations can layer cleanly via Framer Motion.
 */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import type {
  BatteryAsset,
  DataCenterAsset,
  Generator,
  Line as ApiLine,
  NetworkData,
  RenewableAsset,
} from '@/types/api'
import { FUEL_COLORS, lmpColor, utilizationColor } from '@/lib/colors'
import { formatLMP, formatMW, formatMWh, formatPct } from '@/lib/format'
import { Tooltip } from '@/components/ui'
import { useThemeColors, type ThemeColors } from '@/lib/theme'

export interface FrameState {
  /** MW dispatch by generator id at this frame */
  genOutput: Record<number, number>
  /** Signed flow MW by line id (positive = from→to) */
  lineFlow: Record<number, number>
  /** Utilization 0..1 by line id */
  lineUtil: Record<number, number>
  /** $/MWh by bus id */
  busLMP: Record<number, number>
  /** load MW by bus id */
  busLoad: Record<number, number>
  /** SOC as fraction of E_max for each battery */
  batterySOC?: Record<string, number>
  /** Charge/discharge MW for each battery (positive discharge, negative charge) */
  batteryNet?: Record<string, number>
  /** Utilization 0..1 for each data center */
  dcUtil?: Record<string, number>
  /** delivered MW for each renewable, fraction of capacity */
  renewFrac?: Record<string, number>
}

export interface NetworkDiagramProps {
  network: NetworkData
  frame?: FrameState
  batteries?: BatteryAsset[]
  dataCenters?: DataCenterAsset[]
  renewables?: RenewableAsset[]
  selectedBus?: number | null
  onBusClick?: (bus: number) => void
  placementMode?: 'battery' | 'data_center' | 'renewable' | null
  width?: number | string
  height?: number | string
  /** Suppress flow / LMP / dispatch overlays — useful before solve */
  baseline?: boolean
}

const VIEWBOX_W = 1200
const VIEWBOX_H = 800

export function NetworkDiagram({
  network,
  frame,
  batteries = [],
  dataCenters = [],
  renewables = [],
  selectedBus,
  onBusClick,
  placementMode,
  width = VIEWBOX_W,
  height = VIEWBOX_H,
  baseline = false,
}: NetworkDiagramProps) {
  const [hoverLine, setHoverLine] = useState<number | null>(null)
  const colors = useThemeColors()

  // LMP color range for current frame
  const { lmpMin, lmpMax } = useMemo(() => {
    if (!frame) return { lmpMin: 0, lmpMax: 100 }
    const vals = Object.values(frame.busLMP)
    if (vals.length === 0) return { lmpMin: 0, lmpMax: 100 }
    return { lmpMin: d3.min(vals) ?? 0, lmpMax: d3.max(vals) ?? 100 }
  }, [frame])

  // Indexed lookups for assets at each bus
  const assetsByBus = useMemo(() => {
    const map = new Map<
      number,
      {
        batteries: BatteryAsset[]
        dataCenters: DataCenterAsset[]
        renewables: RenewableAsset[]
      }
    >()
    for (const b of network.buses) {
      map.set(b.id, { batteries: [], dataCenters: [], renewables: [] })
    }
    batteries.forEach((b) => {
      const e = map.get(b.bus)
      if (e) e.batteries.push(b)
    })
    dataCenters.forEach((d) => {
      const e = map.get(d.bus)
      if (e) e.dataCenters.push(d)
    })
    renewables.forEach((r) => {
      const e = map.get(r.bus)
      if (e) e.renewables.push(r)
    })
    return map
  }, [network.buses, batteries, dataCenters, renewables])

  // Build a quick lookup of bus → coords
  const busById = useMemo(
    () => new Map(network.buses.map((b) => [b.id, b])),
    [network.buses],
  )

  // Render generators around their bus position (small offsets so multiple gens don't overlap)
  const generatorPositions = useMemo(() => {
    const byBus = d3.group(network.generators, (g) => g.bus)
    const positions = new Map<number, { gen: Generator; x: number; y: number }>()
    byBus.forEach((gens, busId) => {
      const bus = busById.get(busId)
      if (!bus) return
      gens.forEach((g, i) => {
        const angle = -Math.PI / 2 + (i / Math.max(gens.length, 1)) * Math.PI * 2
        const r = 28
        positions.set(g.id, {
          gen: g,
          x: bus.x + Math.cos(angle) * r,
          y: bus.y + Math.sin(angle) * r,
        })
      })
    })
    return positions
  }, [network.generators, busById])

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      width={width}
      height={height}
      className="select-none"
      role="img"
      aria-label={`${network.display_name} bus diagram`}
    >
      {/* Faint grid background */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1" fill={colors.border} />
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={VIEWBOX_W} height={VIEWBOX_H} fill="url(#grid)" />

      {/* Lines */}
      <g>
        {network.lines.map((ln) => {
          const a = busById.get(ln.from_bus)
          const b = busById.get(ln.to_bus)
          if (!a || !b) return null
          return (
            <NetworkLine
              key={ln.id}
              line={ln}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              flow={frame?.lineFlow?.[ln.id] ?? 0}
              utilization={frame?.lineUtil?.[ln.id] ?? 0}
              hovered={hoverLine === ln.id}
              onHover={(id) => setHoverLine(id)}
              baseline={baseline}
              colors={colors}
            />
          )
        })}
      </g>

      {/* Generators */}
      <g>
        {Array.from(generatorPositions.values()).map(({ gen, x, y }) => (
          <NetworkGenerator
            key={gen.id}
            gen={gen}
            x={x}
            y={y}
            output={frame?.genOutput?.[gen.id] ?? 0}
            baseline={baseline}
          />
        ))}
      </g>

      {/* Buses */}
      <g>
        {network.buses.map((bus) => {
          const lmp = frame?.busLMP?.[bus.id]
          const load = frame?.busLoad?.[bus.id]
          const isSelected = selectedBus === bus.id
          const assets = assetsByBus.get(bus.id)
          return (
            <NetworkBus
              key={bus.id}
              bus={bus}
              lmp={lmp}
              load={load}
              lmpMin={lmpMin}
              lmpMax={lmpMax}
              selected={isSelected}
              placementMode={placementMode ?? null}
              onClick={() => onBusClick?.(bus.id)}
              assetCount={
                (assets?.batteries.length ?? 0) +
                (assets?.dataCenters.length ?? 0) +
                (assets?.renewables.length ?? 0)
              }
              baseline={baseline}
              colors={colors}
            />
          )
        })}
      </g>

      {/* Asset glyphs */}
      <g>
        {batteries.map((b) => {
          const bus = busById.get(b.bus)
          if (!bus) return null
          return (
            <BatteryGlyph
              key={b.id}
              bat={b}
              x={bus.x + 22}
              y={bus.y - 22}
              soc={frame?.batterySOC?.[b.id] ?? 0.5}
              net={frame?.batteryNet?.[b.id] ?? 0}
              baseline={baseline}
              colors={colors}
            />
          )
        })}
        {dataCenters.map((d) => {
          const bus = busById.get(d.bus)
          if (!bus) return null
          return (
            <DataCenterGlyph
              key={d.id}
              dc={d}
              x={bus.x - 22}
              y={bus.y - 22}
              util={frame?.dcUtil?.[d.id] ?? 0.7}
              baseline={baseline}
              colors={colors}
            />
          )
        })}
        {renewables.map((r) => {
          const bus = busById.get(r.bus)
          if (!bus) return null
          return (
            <RenewableGlyph
              key={r.id}
              ren={r}
              x={bus.x + 22}
              y={bus.y + 22}
              frac={frame?.renewFrac?.[r.id] ?? 0.5}
              baseline={baseline}
              colors={colors}
            />
          )
        })}
      </g>
    </svg>
  )
}

// ----- sub-components -----

interface NetworkLineProps {
  line: ApiLine
  x1: number
  y1: number
  x2: number
  y2: number
  flow: number
  utilization: number
  hovered: boolean
  onHover: (id: number | null) => void
  baseline: boolean
  colors: ThemeColors
}

function NetworkLine({
  line,
  x1,
  y1,
  x2,
  y2,
  flow,
  utilization,
  hovered,
  onHover,
  baseline,
  colors,
}: NetworkLineProps) {
  const color = baseline ? colors.text3 : utilizationColor(utilization)
  const thickness = baseline
    ? 2
    : Math.max(1.5, Math.min(7, 1.5 + Math.abs(flow) / 60))
  const animatedDash = !baseline && Math.abs(flow) > 1 ? '8,4' : undefined
  const dir = flow >= 0 ? 1 : -1

  return (
    <Tooltip
      content={
        <div className="text-[11px] mono space-y-0.5">
          <div className="font-semibold text-text-1">{line.name}</div>
          <div>
            Capacity <span className="text-text-1">{formatMW(line.capacity_mva)}</span>
          </div>
          {!baseline && (
            <>
              <div>
                Flow <span className="text-text-1">{formatMW(Math.abs(flow))}</span>{' '}
                {dir > 0 ? '→' : '←'}
              </div>
              <div>
                Utilization{' '}
                <span style={{ color }}>{formatPct(Math.min(1.5, utilization))}</span>
              </div>
            </>
          )}
        </div>
      }
    >
      <g
        onMouseEnter={() => onHover(line.id)}
        onMouseLeave={() => onHover(null)}
        className="cursor-help"
      >
        {/* hit area */}
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={animatedDash}
          opacity={hovered ? 1 : 0.85}
        >
          {animatedDash && (
            <animate
              attributeName="stroke-dashoffset"
              from={dir > 0 ? '12' : '0'}
              to={dir > 0 ? '0' : '12'}
              dur="0.8s"
              repeatCount="indefinite"
            />
          )}
        </line>
      </g>
    </Tooltip>
  )
}

interface NetworkGeneratorProps {
  gen: Generator
  x: number
  y: number
  output: number
  baseline: boolean
}

function NetworkGenerator({ gen, x, y, output, baseline }: NetworkGeneratorProps) {
  const color = FUEL_COLORS[gen.fuel]
  const utilization = baseline ? 0.6 : Math.max(0.05, Math.min(1, output / gen.capacity_mw))
  const r = 6 + utilization * 7
  return (
    <Tooltip
      content={
        <div className="text-[11px] mono space-y-0.5">
          <div className="font-semibold text-text-1">{gen.name}</div>
          <div>
            Fuel <span style={{ color }}>{gen.fuel}</span>
          </div>
          <div>
            Capacity <span className="text-text-1">{formatMW(gen.capacity_mw)}</span>
          </div>
          {!baseline && (
            <div>
              Output <span className="text-text-1">{formatMW(output)}</span> ({formatPct(utilization)})
            </div>
          )}
          <div>
            Cost <span className="text-text-1">${gen.cost_per_mwh}/MWh</span>
          </div>
        </div>
      }
    >
      <motion.g
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="cursor-help"
      >
        <circle cx={x} cy={y} r={r} fill={color} opacity={0.85} />
        <circle cx={x} cy={y} r={r + 2} fill="none" stroke={color} opacity={0.3} />
      </motion.g>
    </Tooltip>
  )
}

interface NetworkBusProps {
  bus: NetworkData['buses'][number]
  lmp?: number
  load?: number
  lmpMin: number
  lmpMax: number
  selected: boolean
  placementMode: 'battery' | 'data_center' | 'renewable' | null
  onClick: () => void
  assetCount: number
  baseline: boolean
  colors: ThemeColors
}

function NetworkBus({
  bus,
  lmp,
  load,
  lmpMin,
  lmpMax,
  selected,
  placementMode,
  onClick,
  baseline,
  colors,
}: NetworkBusProps) {
  const fill =
    !baseline && lmp !== undefined ? lmpColor(lmp, lmpMin, lmpMax) : colors.busFill
  const stroke = bus.is_slack
    ? '#fde047' /* slack always stands out */
    : selected
      ? colors.accent
      : colors.busStroke
  const placementGlow = placementMode !== null

  return (
    <Tooltip
      content={
        <div className="text-[11px] mono space-y-0.5">
          <div className="font-semibold text-text-1">{bus.name}</div>
          <div>{bus.base_kv} kV {bus.is_slack && '· slack'}</div>
          {load !== undefined && (
            <div>
              Load <span className="text-text-1">{formatMW(load)}</span>
            </div>
          )}
          {!baseline && lmp !== undefined && (
            <div>
              LMP <span className="text-text-1">{formatLMP(lmp)}</span>
            </div>
          )}
        </div>
      }
    >
      <motion.g
        onClick={onClick}
        whileHover={{ scale: 1.06 }}
        className={placementGlow ? 'cursor-crosshair' : 'cursor-pointer'}
        animate={{ filter: placementGlow ? 'url(#glow)' : 'none' }}
      >
        {placementGlow && (
          <circle
            cx={bus.x}
            cy={bus.y}
            r={20}
            fill="none"
            stroke={colors.accent}
            strokeOpacity={0.5}
            strokeWidth={2}
            strokeDasharray="3,3"
          >
            <animate
              attributeName="r"
              values="18;24;18"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        <circle
          cx={bus.x}
          cy={bus.y}
          r={selected ? 14 : 12}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 3 : 2}
        />
        <text
          x={bus.x}
          y={bus.y + 4}
          textAnchor="middle"
          fill={baseline ? colors.text1 : '#ffffff'}
          fontSize={10}
          fontFamily="IBM Plex Mono, monospace"
          fontWeight={600}
          pointerEvents="none"
        >
          {bus.id}
        </text>
        <text
          x={bus.x}
          y={bus.y - 18}
          textAnchor="middle"
          fill={colors.text2}
          fontSize={9}
          fontFamily="IBM Plex Mono, monospace"
          pointerEvents="none"
        >
          {!baseline && lmp !== undefined ? formatLMP(lmp) : bus.name}
        </text>
      </motion.g>
    </Tooltip>
  )
}

function BatteryGlyph({
  bat,
  x,
  y,
  soc,
  net,
  baseline,
  colors,
}: {
  bat: BatteryAsset
  x: number
  y: number
  soc: number
  net: number
  baseline: boolean
  colors: ThemeColors
}) {
  const fillFrac = baseline ? bat.initial_soc_mwh / bat.e_max_mwh : Math.max(0, Math.min(1, soc))
  const charging = net < -0.1
  const discharging = net > 0.1
  return (
    <Tooltip
      content={
        <div className="text-[11px] mono space-y-0.5">
          <div className="font-semibold text-text-1">{bat.id}</div>
          <div>
            E_max <span className="text-text-1">{formatMWh(bat.e_max_mwh)}</span>{' '}
            · P_max <span className="text-text-1">{formatMW(bat.p_max_mw)}</span>
          </div>
          {!baseline && (
            <>
              <div>
                SOC <span className="text-text-1">{formatPct(fillFrac)}</span>
              </div>
              <div>
                {charging
                  ? `Charging at ${formatMW(-net)}`
                  : discharging
                    ? `Discharging at ${formatMW(net)}`
                    : 'Idle'}
              </div>
            </>
          )}
        </div>
      }
    >
      <g className="cursor-help">
        <rect x={x - 7} y={y - 9} width={14} height={18} rx={2} fill={colors.bg} stroke={colors.success} />
        <rect x={x - 4} y={y + 9 - fillFrac * 16} width={8} height={fillFrac * 16} fill={colors.success} />
        <rect x={x - 2.5} y={y - 12} width={5} height={3} fill={colors.success} />
        {(charging || discharging) && (
          <circle cx={x + 9} cy={y - 9} r={2} fill={charging ? '#22d3ee' : '#fde047'}>
            <animate attributeName="r" values="1.5;3;1.5" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
    </Tooltip>
  )
}

function DataCenterGlyph({
  dc,
  x,
  y,
  util,
  baseline,
  colors,
}: {
  dc: DataCenterAsset
  x: number
  y: number
  util: number
  baseline: boolean
  colors: ThemeColors
}) {
  const u = baseline ? 0.7 : Math.max(0, Math.min(1, util))
  return (
    <Tooltip
      content={
        <div className="text-[11px] mono space-y-0.5">
          <div className="font-semibold text-text-1">{dc.id}</div>
          <div>
            C_max <span className="text-text-1">{formatMW(dc.c_max_mw)}</span>
          </div>
          {!baseline && (
            <div>
              Utilization <span className="text-text-1">{formatPct(u)}</span>
            </div>
          )}
        </div>
      }
    >
      <g className="cursor-help">
        <rect x={x - 9} y={y - 9} width={18} height={18} rx={2} fill={colors.bg} stroke="#a855f7" />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={x - 7}
            y={y - 7 + i * 5}
            width={14}
            height={3}
            fill={i / 3 < u ? '#a855f7' : colors.border}
          />
        ))}
      </g>
    </Tooltip>
  )
}

function RenewableGlyph({
  ren,
  x,
  y,
  frac,
  baseline,
  colors,
}: {
  ren: RenewableAsset
  x: number
  y: number
  frac: number
  baseline: boolean
  colors: ThemeColors
}) {
  const f = baseline ? 0.5 : Math.max(0, Math.min(1, frac))
  const color = ren.kind === 'solar' ? '#fde047' : '#22d3ee'
  return (
    <Tooltip
      content={
        <div className="text-[11px] mono space-y-0.5">
          <div className="font-semibold text-text-1">{ren.id}</div>
          <div>
            {ren.kind} · <span className="text-text-1">{formatMW(ren.capacity_mw)}</span>
          </div>
          {!baseline && (
            <div>
              Output <span className="text-text-1">{formatPct(f)}</span> of capacity
            </div>
          )}
        </div>
      }
    >
      <g className="cursor-help">
        <circle cx={x} cy={y} r={9} fill={colors.bg} stroke={color} />
        {ren.kind === 'solar' ? (
          <>
            <circle cx={x} cy={y} r={3 + f * 4} fill={color} />
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180
              return (
                <line
                  key={deg}
                  x1={x + Math.cos(rad) * 5}
                  y1={y + Math.sin(rad) * 5}
                  x2={x + Math.cos(rad) * 8}
                  y2={y + Math.sin(rad) * 8}
                  stroke={color}
                  strokeOpacity={f}
                />
              )
            })}
          </>
        ) : (
          <g>
            {[0, 120, 240].map((deg) => (
              <line
                key={deg}
                x1={x}
                y1={y}
                x2={x + Math.cos((deg * Math.PI) / 180) * 7}
                y2={y + Math.sin((deg * Math.PI) / 180) * 7}
                stroke={color}
                strokeWidth={2}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${deg} ${x} ${y}`}
                  to={`${deg + 360} ${x} ${y}`}
                  dur={`${2 - f}s`}
                  repeatCount="indefinite"
                />
              </line>
            ))}
            <circle cx={x} cy={y} r={2} fill={color} />
          </g>
        )}
      </g>
    </Tooltip>
  )
}
