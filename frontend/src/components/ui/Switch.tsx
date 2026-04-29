import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label?: string
  className?: string
}

export function Switch({ checked, onCheckedChange, label, className }: SwitchProps) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer', className)}>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          'w-9 h-5 bg-border rounded-full relative outline-none',
          'data-[state=checked]:bg-accent transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block w-4 h-4 bg-white rounded-full shadow-card',
            'translate-x-0.5 transition-transform',
            'data-[state=checked]:translate-x-[18px]',
          )}
        />
      </RadixSwitch.Root>
      {label && <span className="text-xs text-text-1">{label}</span>}
    </label>
  )
}
