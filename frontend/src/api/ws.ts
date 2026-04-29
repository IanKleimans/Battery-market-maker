/** WebSocket helper for streaming solve progress. */

import type { MultiPeriodRequest, WsEvent } from '@/types/api'
import { BASE_URL } from './client'

export function streamSolve(
  req: MultiPeriodRequest,
  onEvent: (e: WsEvent) => void,
): () => void {
  // Convert http(s) to ws(s) and append the WS path
  let httpBase = BASE_URL
  if (!httpBase) {
    httpBase = window.location.origin
  }
  const wsUrl = httpBase.replace(/^http/, 'ws') + '/api/v1/ws/solve'
  const ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws.send(JSON.stringify(req))
  }
  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as WsEvent)
    } catch (err) {
      onEvent({ event: 'failed', error: String(err) })
    }
  }
  ws.onerror = () => {
    onEvent({ event: 'failed', error: 'WebSocket error' })
  }

  return () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
  }
}
