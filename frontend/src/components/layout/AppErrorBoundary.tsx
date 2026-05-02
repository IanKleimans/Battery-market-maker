/** Top-level React error boundary that catches component render errors.
 *
 * Distinct from `RouteErrorBoundary` (which catches errors thrown from React
 * Router loaders/actions). Mount this around each route's element so a render
 * crash in one page doesn't blank the whole app. */

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button, Card } from '@/components/ui'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      // Surface the full stack only in dev. Production swallows console noise.
      console.error('[AppErrorBoundary]', error, info.componentStack)
    }
  }

  private handleReload = (): void => {
    this.setState({ error: null })
    window.location.reload()
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text-1">
                Something rendered incorrectly
              </h2>
              <p className="text-xs text-text-2 mt-1">
                A component on this page hit an unexpected state. Reload to recover.
              </p>
              <p className="text-[10px] text-text-2 mono mt-2 break-words">
                {error.message}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={this.handleReload}>
            <RotateCcw size={14} /> Reload page
          </Button>
        </Card>
      </div>
    )
  }
}
