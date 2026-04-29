import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface MetricCardProps {
  label: string
  value: ReactNode
  unit?: string
  delta?: { value: number; label?: string }
  icon?: ReactNode
  className?: string
  loading?: boolean
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  icon,
  className,
  loading,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className={cn('bg-surface border border-border rounded p-4', className)}>
        <div className="h-3 w-20 skeleton mb-3" />
        <div className="h-7 w-32 skeleton" />
      </div>
    )
  }

  const trend = delta
    ? delta.value > 0
      ? 'up'
      : delta.value < 0
        ? 'down'
        : 'flat'
    : null

  return (
    <div
      className={cn(
        'bg-surface border border-border rounded p-4',
        'hover:border-accent/40 transition-colors',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-text-2 uppercase tracking-wider">{label}</span>
        {icon && <div className="text-text-2">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold mono tabular-nums text-text-1">
          {value}
        </span>
        {unit && <span className="text-xs text-text-2">{unit}</span>}
      </div>
      {delta && (
        <div
          className={cn(
            'mt-2 flex items-center gap-1 text-xs mono',
            trend === 'up' && 'text-success',
            trend === 'down' && 'text-danger',
            trend === 'flat' && 'text-text-2',
          )}
        >
          {trend === 'up' && <TrendingUp size={12} />}
          {trend === 'down' && <TrendingDown size={12} />}
          {trend === 'flat' && <Minus size={12} />}
          <span>
            {delta.value > 0 ? '+' : ''}
            {delta.value.toFixed(1)}
            {delta.label ? ` ${delta.label}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
