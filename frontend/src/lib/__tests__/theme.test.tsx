import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme, useThemeColors } from '../theme'

function ThemeProbe() {
  const { theme, toggle } = useTheme()
  const colors = useThemeColors()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="bg">{colors.bg}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('light')
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to dark when nothing is set', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('bg').textContent).toBe('#06080f')
  })

  it('reads light from existing class on <html>', () => {
    document.documentElement.classList.add('light')
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(screen.getByTestId('bg').textContent).toBe('#f8fafc')
  })

  it('toggles between dark and light, persisting to localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    act(() => {
      screen.getByText('toggle').click()
    })
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    act(() => {
      screen.getByText('toggle').click()
    })
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})
