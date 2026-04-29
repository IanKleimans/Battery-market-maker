/** Theme provider and color hooks.
 *
 * A `ThemeProvider` wraps the app and toggles a `light` / no class on the
 * <html> element.  The actual color tokens live in CSS variables (see
 * src/index.css) so most components don't need to read the theme at all.
 *
 * Components that take color *strings* (recharts axes/grids, raw D3 SVG
 * fills, SVG patterns) can call `useThemeColors()` to get a flat object of
 * resolved hex colors keyed by token.  Those strings are kept in sync with
 * the CSS variables defined in `index.css`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark'

interface ThemeCtx {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

const Ctx = createContext<ThemeCtx | null>(null)

const STORAGE_KEY = 'theme'

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  // index.html runs an inline script that sets the class before paint,
  // so the DOM is the source of truth for the initial render.
  if (document.documentElement.classList.contains('light')) return 'light'
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme)

  // Apply theme class + persist + briefly enable global color transitions
  // so the switch animates (200ms), without making every hover transition
  // global afterward.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')
    if (theme === 'light') root.classList.add('light')
    else root.classList.remove('light')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* storage unavailable — theme still works for the session */
    }
    const handle = window.setTimeout(
      () => root.classList.remove('theme-transitioning'),
      300,
    )
    return () => window.clearTimeout(handle)
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(
    () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  )

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme must be used within ThemeProvider')
  return v
}

export interface ThemeColors {
  bg: string
  surface: string
  surfaceHover: string
  border: string
  text1: string
  text2: string
  text3: string
  accent: string
  accentHover: string
  success: string
  warning: string
  danger: string
  /* chart helpers */
  axisLabel: string
  gridLine: string
  /* network diagram helpers */
  busFill: string
  busStroke: string
  /* tooltip background (intentionally inverted-ish for contrast) */
  tooltipBg: string
}

const DARK: ThemeColors = {
  bg: '#06080f',
  surface: '#0c1221',
  surfaceHover: '#111a2f',
  border: '#162040',
  text1: '#f1f5f9',
  text2: '#64748b',
  text3: '#334155',
  accent: '#2563eb',
  accentHover: '#1d4ed8',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  axisLabel: '#64748b',
  gridLine: '#162040',
  busFill: '#0c1221',
  busStroke: '#162040',
  tooltipBg: '#06080f',
}

const LIGHT: ThemeColors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceHover: '#f1f5f9',
  border: '#e2e8f0',
  text1: '#0f172a',
  text2: '#475569',
  text3: '#94a3b8',
  accent: '#2563eb',
  accentHover: '#1d4ed8',
  success: '#10b981',
  warning: '#d97706',
  danger: '#dc2626',
  axisLabel: '#475569',
  gridLine: '#e2e8f0',
  busFill: '#ffffff',
  busStroke: '#cbd5e1',
  tooltipBg: '#0f172a',
}

export function useThemeColors(): ThemeColors {
  const { theme } = useTheme()
  return theme === 'light' ? LIGHT : DARK
}
