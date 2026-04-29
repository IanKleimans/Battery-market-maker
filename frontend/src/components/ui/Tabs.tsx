import * as RadixTabs from '@radix-ui/react-tabs'
import { cn } from '@/lib/cn'

export const Tabs = RadixTabs.Root

export function TabList({
  className,
  ...props
}: RadixTabs.TabsListProps) {
  return (
    <RadixTabs.List
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded bg-surface border border-border',
        className,
      )}
      {...props}
    />
  )
}

export function Tab({
  className,
  ...props
}: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'px-3 h-7 text-xs font-medium rounded',
        'text-text-2 hover:text-text-1 transition-colors',
        'data-[state=active]:bg-accent data-[state=active]:text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
      {...props}
    />
  )
}

export function TabPanel({
  className,
  ...props
}: RadixTabs.TabsContentProps) {
  return (
    <RadixTabs.Content
      className={cn('focus-visible:outline-none', className)}
      {...props}
    />
  )
}
