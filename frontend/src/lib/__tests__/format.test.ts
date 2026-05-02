import { describe, it, expect } from 'vitest'
import {
  formatFixed,
  formatHourLabel,
  formatLMP,
  formatMW,
  formatMWh,
  formatMs,
  formatPct,
  formatSeconds,
  formatTime,
  formatUSD,
} from '../format'

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
    expect(formatUSD(-Infinity)).toBe('—')
  })

  it('handles null and undefined safely', () => {
    expect(formatUSD(null)).toBe('—')
    expect(formatUSD(undefined)).toBe('—')
    expect(formatMW(null)).toBe('—')
    expect(formatMWh(null)).toBe('—')
    expect(formatLMP(null)).toBe('—')
    expect(formatPct(null)).toBe('—')
    expect(formatFixed(null)).toBe('—')
    expect(formatMs(null)).toBe('—')
    expect(formatSeconds(null)).toBe('—')
  })

  it('formats currency without cents by default', () => {
    expect(formatUSD(1234)).toBe('$1,234')
    expect(formatUSD(1234.56, true)).toBe('$1,234.56')
  })

  it('formatFixed obeys digits arg', () => {
    expect(formatFixed(3.14159, 3)).toBe('3.142')
    expect(formatFixed(0)).toBe('0.00')
  })

  it('formatMs converts seconds to integer ms', () => {
    expect(formatMs(0.123)).toBe('123 ms')
    expect(formatMs(1.5)).toBe('1500 ms')
  })

  it('formatSeconds renders s suffix', () => {
    expect(formatSeconds(2.345, 2)).toBe('2.35 s')
  })

  it('time helpers handle bad input', () => {
    expect(formatTime(null)).toBe('—')
    expect(formatTime('not-a-date')).toBe('—')
    expect(formatHourLabel(undefined)).toBe('—')
    expect(formatHourLabel('garbage')).toBe('—')
  })
})
