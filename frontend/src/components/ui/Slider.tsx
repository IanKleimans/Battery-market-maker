import * as RadixSlider from '@radix-ui/react-slider'
import { cn } from '@/lib/cn'

export interface SliderProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  unit?: string
  format?: (v: number) => string
  disabled?: boolean
  className?: string
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit,
  format,
  disabled,
  className,
}: SliderProps) {
  const display = format ? format(value) : `${value}${unit ? ` ${unit}` : ''}`
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-text-2">{label}</span>
          <span className="mono text-xs text-text-1 tabular-nums">{display}</span>
        </div>
      )}
      <RadixSlider.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={[value]}
        onValueChange={(vs) => onChange(vs[0]!)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <RadixSlider.Track className="bg-border relative grow rounded-full h-1.5">
          <RadixSlider.Range
            className="absolute rounded-full h-full bg-gradient-to-r from-accent to-accent-hover"
          />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-label={label ?? 'value'}
          className={cn(
            'block w-4 h-4 bg-white rounded-full shadow-card',
            'border-2 border-accent',
            'hover:scale-110 transition-transform',
            'focus-visible:ring-4 focus-visible:ring-accent/30',
          )}
        />
      </RadixSlider.Root>
    </div>
  )
}
