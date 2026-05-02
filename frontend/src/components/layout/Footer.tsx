/** Persistent terminal-style footer status bar.
 *
 * Shows API health, current data source, last solve latency, and a small
 * blinking cursor. Honest about what's live vs synthetic. */

import { useApiHealth, type HealthState } from '@/hooks/useApiHealth'
import { useSimulator } from '@/store/simulator'
import { formatMs, formatSeconds } from '@/lib/format'

const STATE_COLOR: Record<HealthState, string> = {
  unknown: 'bg-text-3',
  healthy: 'bg-success',
  degraded: 'bg-warning',
  down: 'bg-danger',
}

const STATE_LABEL: Record<HealthState, string> = {
  unknown: 'unknown',
  healthy: 'live',
  degraded: 'slow',
  down: 'down',
}

export function Footer() {
  const health = useApiHealth()
  const liveSolve = useSimulator((s) => s.liveResult?.solve_time_seconds ?? null)
  const multiSolve = useSimulator((s) => s.solveElapsed)
  const liveLoading = useSimulator((s) => s.liveLoading)

  return (
    <footer className="border-t border-border bg-surface/60 backdrop-blur-sm">
      <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center justify-between text-[11px] text-text-2 mono gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* API health */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${STATE_COLOR[health.state]} ${
                health.state === 'healthy' ? 'animate-pulse' : ''
              }`}
              aria-hidden
            />
            <span>
              api {STATE_LABEL[health.state]}
              {health.rtt_ms !== null && (
                <span className="text-text-3"> {health.rtt_ms} ms</span>
              )}
            </span>
          </div>

          {/* Data source */}
          <span className="text-text-3">·</span>
          <span>
            data <span className="text-text-1">SYNTHETIC</span>
          </span>

          {/* Last solve */}
          <span className="text-text-3">·</span>
          <span>
            live{' '}
            <span className="text-text-1">
              {liveLoading ? '…' : formatMs(liveSolve)}
            </span>
          </span>

          {multiSolve !== null && (
            <>
              <span className="text-text-3">·</span>
              <span>
                opt <span className="text-text-1">{formatSeconds(multiSolve, 2)}</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <a href="/about" className="hover:text-text-1 transition-colors">
            methodology
          </a>
          <a
            href="https://github.com/IanKleimans/Battery-market-maker"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-1 transition-colors"
          >
            github
          </a>
          <a
            href="/api/v1/health"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-1 transition-colors"
          >
            api
          </a>
          <span className="text-accent animate-pulse">▌</span>
        </div>
      </div>
    </footer>
  )
}
