import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SelectProps {
  value: string
  onValueChange: (v: string) => void
  options: { value: string; label: ReactNode; description?: string }[]
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  size = 'md',
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded',
          'bg-surface border border-border text-text-1 hover:border-accent',
          'px-3 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 min-w-[var(--radix-select-trigger-width)]',
            'bg-surface border border-border rounded shadow-card-hover',
            'animate-fade-in p-1 max-h-72 overflow-y-auto',
          )}
        >
          <RadixSelect.Viewport>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span className="text-sm">{opt.label}</span>
                  {opt.description && (
                    <span className="text-[11px] text-text-2 mt-0.5">{opt.description}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

interface SelectItemProps {
  value: string
  children: ReactNode
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(function SelectItem(
  { value, children },
  ref,
) {
  return (
    <RadixSelect.Item
      ref={ref}
      value={value}
      className={cn(
        'relative flex items-center px-2.5 py-1.5 rounded text-sm',
        'cursor-pointer text-text-1',
        'data-[highlighted]:bg-accent data-[highlighted]:text-white',
        'data-[state=checked]:font-medium',
        'focus-visible:outline-none',
      )}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute right-2 inline-flex items-center">
        <Check size={14} />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
})
