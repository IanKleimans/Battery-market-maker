import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/lib/theme'
import { ThemeToggle } from '../ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('light')
    localStorage.clear()
  })

  it('shows the right aria-label per mode and toggles on click', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )
    const btn = screen.getByRole('button', { name: /switch to light mode/i })
    expect(btn).toBeInTheDocument()
    await userEvent.click(btn)
    expect(
      screen.getByRole('button', { name: /switch to dark mode/i }),
    ).toBeInTheDocument()
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })
})
