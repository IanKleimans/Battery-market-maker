import * as RadixToast from '@radix-ui/react-toast'
import { create } from 'zustand'
import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type ToastTone = 'info' | 'success' | 'warning' | 'danger'

interface ToastItem {
  id: string
  title?: string
  description?: string
  tone: ToastTone
}

interface ToastStore {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { ...t, id: Math.random().toString(36).slice(2) },
      ],
    })),
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function toast(
  toneOrItem: ToastTone | (Omit<ToastItem, 'id'> & { tone?: ToastTone }),
  options?: { title?: string; description?: string },
) {
  const push = useToastStore.getState().push
  if (typeof toneOrItem === 'string') {
    push({ tone: toneOrItem, title: options?.title, description: options?.description })
  } else {
    push({ ...toneOrItem, tone: toneOrItem.tone ?? 'info' })
  }
}

export function ToastViewport({ children }: { children?: ReactNode }) {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <RadixToast.Provider swipeDirection="right" duration={4500}>
      {children}
      {toasts.map((t) => (
        <RadixToast.Root
          key={t.id}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            'rounded border bg-surface shadow-card-hover p-3 mb-2 w-80 animate-slide-up',
            t.tone === 'success' && 'border-success/40',
            t.tone === 'warning' && 'border-warning/40',
            t.tone === 'danger' && 'border-danger/40',
            t.tone === 'info' && 'border-border',
          )}
        >
          {t.title && (
            <RadixToast.Title className="text-sm font-semibold text-text-1">
              {t.title}
            </RadixToast.Title>
          )}
          {t.description && (
            <RadixToast.Description className="text-xs text-text-2 mt-1">
              {t.description}
            </RadixToast.Description>
          )}
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className="fixed top-4 right-4 flex flex-col gap-2 z-[100] outline-none" />
    </RadixToast.Provider>
  )
}
