/** Tiny typed fetch client for the FastAPI backend. */

import type {
  MultiPeriodRequest,
  MultiPeriodSolution,
  NetworkData,
  NetworkName,
  NetworkSummary,
  Scenario,
  ScenarioSummary,
  SDPResponse,
  SinglePeriodRequest,
  SinglePeriodSolution,
} from '@/types/api'

const BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  ''

const API = `${BASE_URL}/api/v1`

class ApiError extends Error {
  status: number
  detail?: unknown
  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      detail = await res.text()
    }
    throw new ApiError(
      `${init?.method ?? 'GET'} ${path} → HTTP ${res.status}`,
      res.status,
      detail,
    )
  }
  return res.json() as Promise<T>
}

export const api = {
  listNetworks: () => request<NetworkSummary[]>('/networks'),
  getNetwork: (name: NetworkName) => request<NetworkData>(`/networks/${name}`),

  multiperiodOPF: (req: MultiPeriodRequest) =>
    request<MultiPeriodSolution>('/optimization/multiperiod', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  singleperiodOPF: (req: SinglePeriodRequest) =>
    request<SinglePeriodSolution>('/optimization/singleperiod', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  listScenarios: () => request<ScenarioSummary[]>('/scenarios'),
  getScenario: (id: string) => request<Scenario>(`/scenarios/${id}`),

  sdpBattery: (req: {
    policies: ('perfect_foresight' | 'myopic_greedy' | 'mpc')[]
    horizon_hours: number
    timestep_minutes: number
    mpc_horizon_hours: number
    forecast: 'perfect' | 'naive' | 'xgboost'
    seed: number
  }) =>
    request<SDPResponse>('/sdp/battery', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  forecastQuality: (req: {
    forecast_type: 'perfect' | 'naive' | 'xgboost'
    horizon_hours: number
    n_samples: number
    seed: number
  }) =>
    request<{
      forecast_type: string
      rmse_per_mwh: number
      mae_per_mwh: number
      bias_per_mwh: number
      actual: number[]
      forecast: number[]
      timestamps: string[]
    }>('/forecasting/quality', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
}

export { ApiError, BASE_URL }
