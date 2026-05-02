/** Number / unit formatting helpers. Always include units in user-facing text.
 *
 * Every helper accepts `number | null | undefined` and returns the em-dash
 * placeholder ('—') for missing or non-finite values. This keeps render code
 * defensive without ad-hoc guards at every call site. */

type Numeric = number | null | undefined

const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const fmtUSDPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const fmtMW = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const fmtPct = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
})

const fmtCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const PLACEHOLDER = '—'

function isUsable(v: Numeric): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function formatUSD(v: Numeric, precise = false): string {
  if (!isUsable(v)) return PLACEHOLDER
  return precise ? fmtUSDPrecise.format(v) : fmtUSD.format(v)
}

export function formatMW(v: Numeric): string {
  if (!isUsable(v)) return PLACEHOLDER
  return `${fmtMW.format(v)} MW`
}

export function formatMWh(v: Numeric): string {
  if (!isUsable(v)) return PLACEHOLDER
  return `${fmtMW.format(v)} MWh`
}

export function formatLMP(v: Numeric): string {
  if (!isUsable(v)) return PLACEHOLDER
  return `$${fmtMW.format(v)}/MWh`
}

export function formatPct(v: Numeric): string {
  if (!isUsable(v)) return PLACEHOLDER
  return fmtPct.format(v)
}

export function formatCompact(v: Numeric): string {
  if (!isUsable(v)) return PLACEHOLDER
  return fmtCompact.format(v)
}

/** Fixed-precision number string. Returns '—' for null/undefined/NaN/Infinity. */
export function formatFixed(v: Numeric, digits = 2): string {
  if (!isUsable(v)) return PLACEHOLDER
  return v.toFixed(digits)
}

/** Milliseconds rendered as integer ms. Returns '—' for null/undefined/NaN. */
export function formatMs(seconds: Numeric): string {
  if (!isUsable(seconds)) return PLACEHOLDER
  return `${Math.round(seconds * 1000)} ms`
}

/** Seconds with N decimals. Returns '—' for null/undefined/NaN. */
export function formatSeconds(seconds: Numeric, digits = 2): string {
  if (!isUsable(seconds)) return PLACEHOLDER
  return `${seconds.toFixed(digits)} s`
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return PLACEHOLDER
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return PLACEHOLDER
    return d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

export function formatHourLabel(iso: string | null | undefined): string {
  if (!iso) return PLACEHOLDER
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return PLACEHOLDER
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}
