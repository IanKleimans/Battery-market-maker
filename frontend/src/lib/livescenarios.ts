/** localStorage-backed save/load for Live-mode "what if" snapshots.
 *
 * Each scenario captures everything that defines a Live solve: the network,
 * load multiplier, wind availability, and the per-element overrides. The
 * 10 backend scenarios live in /api/scenarios; this is a separate, faster
 * surface for the user's own bookmarks. */

import type { NetworkName } from '@/types/api'
import type { LiveOverrides } from '@/store/simulator'

const STORAGE_KEY = 'bmm.live-scenarios.v1'

export interface SavedLiveScenario {
  id: string
  name: string
  saved_at: number
  network: NetworkName
  load_multiplier: number
  wind_availability: number
  overrides: LiveOverrides
}

function readAll(): SavedLiveScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as SavedLiveScenario[]
  } catch {
    return []
  }
}

function writeAll(items: SavedLiveScenario[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage may be full or disabled (private mode). Fail silently —
    // the in-memory simulator state is the source of truth for the session.
  }
}

export function listScenarios(): SavedLiveScenario[] {
  return readAll().sort((a, b) => b.saved_at - a.saved_at)
}

export function saveScenario(s: Omit<SavedLiveScenario, 'id' | 'saved_at'>): SavedLiveScenario {
  const item: SavedLiveScenario = {
    ...s,
    id: `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    saved_at: Date.now(),
  }
  writeAll([item, ...readAll()])
  return item
}

export function deleteScenario(id: string): void {
  writeAll(readAll().filter((x) => x.id !== id))
}

export function renameScenario(id: string, name: string): void {
  writeAll(readAll().map((x) => (x.id === id ? { ...x, name } : x)))
}
