/** Router-level error boundary.
 *
 * Distinguishes API errors (likely backend cold-start on Railway) from
 * frontend exceptions, and offers different recovery copy + actions for each.
 * Frontend render errors that originate inside a page component are caught
 * by `AppErrorBoundary`, not here. */

import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button, Card } from '@/components/ui'

const NETWORK_HINTS = /fetch|network|timeout|aborted|connection|failed to fetch/i

function looksLikeBackendIssue(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500 || err.status === 0
  if (isRouteErrorResponse(err)) return err.status >= 500 || err.status === 0
  if (err instanceof Error) return NETWORK_HINTS.test(err.message)
  return false
}

export function RouteErrorBoundary() {
  const error = useRouteError()

  if (looksLikeBackendIssue(error)) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text-1">
                The backend is waking up
              </h2>
              <p className="text-xs text-text-2 mt-1">
                Railway cold-starts the API after idle. Try again in 10-15 seconds.
              </p>
              {error instanceof Error && (
                <p className="text-[10px] text-text-2 mono mt-2 break-words">
                  {error.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => window.location.reload()}>
              <RotateCcw size={14} /> Retry
            </Button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded bg-surface text-text-1 border border-border hover:border-accent hover:bg-surface-hover"
            >
              <ArrowLeft size={14} /> Home
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // Frontend render error or 4xx that the page can't recover from on its own.
  let title = 'Something rendered incorrectly'
  let detail = 'A component hit an unexpected state. Reload to recover.'
  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    detail = String(error.data ?? detail)
  } else if (error instanceof Error) {
    detail = error.message
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-4">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-1">{title}</h2>
            <p className="text-xs text-text-2 mt-1 break-words">{detail}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.location.reload()}>
            <RotateCcw size={14} /> Reload page
          </Button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded bg-surface text-text-1 border border-border hover:border-accent hover:bg-surface-hover"
          >
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </Card>
    </div>
  )
}
