import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button, Card } from '@/components/ui'

export function RouteErrorBoundary() {
  const error = useRouteError()

  let title = 'Something unexpected happened'
  let detail = 'The page failed to load. This usually means the API is unreachable or returned an unexpected response.'

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    detail = error.data ?? detail
  } else if (error instanceof Error) {
    detail = error.message
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-warning shrink-0 mt-0.5">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-1">{title}</h2>
            <p className="text-xs text-text-2 mt-1">{String(detail)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded bg-surface text-text-1 border border-border hover:border-accent hover:bg-surface-hover"
          >
            <ArrowLeft size={14} /> Home
          </Link>
          <Button size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
        <p className="text-[10px] text-text-2 mono mt-4">
          If this keeps happening, the backend may be cold-starting on Railway —
          give it 10–15 seconds and try again.
        </p>
      </Card>
    </div>
  )
}
