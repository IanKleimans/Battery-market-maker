import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppErrorBoundary } from '../AppErrorBoundary'

function Boom(): never {
  throw new Error('synthetic render error')
}

describe('AppErrorBoundary', () => {
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // React logs caught errors to console.error during render. Silence it so
    // the test output stays clean.
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errSpy.mockRestore()
  })

  it('renders children on the happy path', () => {
    render(
      <AppErrorBoundary>
        <div>healthy</div>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('healthy')).toBeInTheDocument()
  })

  it('catches a render error and shows a recovery UI', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(screen.getByText(/rendered incorrectly/i)).toBeInTheDocument()
    expect(screen.getByText(/synthetic render error/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
  })
})
