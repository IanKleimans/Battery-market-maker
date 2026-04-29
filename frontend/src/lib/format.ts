/** Number / unit formatting helpers. Always include units in user-facing text. */

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

export function formatUSD(v: number, precise = false): string {
  if (!Number.isFinite(v)) return '—'
  return precise ? fmtUSDPrecise.format(v) : fmtUSD.format(v)
}

export function formatMW(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return `${fmtMW.format(v)} MW`
}

export function formatMWh(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return `${fmtMW.format(v)} MWh`
}

export function formatLMP(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return `$${fmtMW.format(v)}/MWh`
}

export function formatPct(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return fmtPct.format(v)
}

export function formatCompact(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return fmtCompact.format(v)
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

export function formatHourLabel(iso: string): string {
  try {
    const d = new Date(iso)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}
