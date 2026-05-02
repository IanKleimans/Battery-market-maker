import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from '../MetricCard'

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Revenue" value="$1,234" unit="USD" />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$1,234')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
  })

  it('renders skeleton when loading', () => {
    const { container } = render(<MetricCard label="x" value="—" loading />)
    expect(container.querySelector('.skeleton')).toBeInTheDocument()
  })

  it('renders delta when value is finite', () => {
    render(
      <MetricCard
        label="Gap"
        value="42"
        delta={{ value: 5.234, label: 'vs PF' }}
      />,
    )
    expect(screen.getByText(/\+5\.2 vs PF/)).toBeInTheDocument()
  })

  it('does not crash when delta.value is null', () => {
    render(
      <MetricCard
        label="Gap"
        value="—"
        delta={{ value: null as unknown as number, label: 'vs PF' }}
      />,
    )
    // Should render the label/value without throwing
    expect(screen.getByText('Gap')).toBeInTheDocument()
    // Delta row is hidden in this state
    expect(screen.queryByText(/vs PF/)).not.toBeInTheDocument()
  })

  it('does not crash when delta.value is undefined', () => {
    render(
      <MetricCard
        label="Gap"
        value="—"
        delta={{ value: undefined as unknown as number }}
      />,
    )
    expect(screen.getByText('Gap')).toBeInTheDocument()
  })

  it('does not crash when delta.value is NaN', () => {
    render(<MetricCard label="Gap" value="—" delta={{ value: NaN }} />)
    expect(screen.getByText('Gap')).toBeInTheDocument()
  })
})
