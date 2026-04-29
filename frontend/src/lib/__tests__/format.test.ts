import { describe, it, expect } from 'vitest'
import { formatLMP, formatMW, formatMWh, formatPct, formatUSD } from '../format'

describe('format helpers', () => {
  it('always renders units', () => {
    expect(formatMW(120.345)).toContain('MW')
    expect(formatMWh(50)).toContain('MWh')
    expect(formatLMP(35.2)).toContain('$')
    expect(formatLMP(35.2)).toContain('/MWh')
    expect(formatPct(0.123)).toContain('%')
  })

  it('handles non-finite values gracefully', () => {
    expect(formatMW(NaN)).toBe('—')
    expect(formatLMP(Infinity)).toBe('—')
    expect(formatUSD(NaN)).toBe('—')
  })

  it('formats currency without cents by default', () => {
    expect(formatUSD(1234)).toBe('$1,234')
    expect(formatUSD(1234.56, true)).toBe('$1,234.56')
  })
})
