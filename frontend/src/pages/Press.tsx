/** Project information page. Architecture, performance numbers, tech stack,
 * and pointers to canonical demo views. No biography. */

import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Battery,
  Calculator as CalculatorIcon,
  Cpu,
  ExternalLink,
  GitFork,
  Server,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Card, CardSubtitle } from '@/components/ui'
import { usePageMeta } from '@/hooks/usePageMeta'

export function Press() {
  usePageMeta({
    title: 'Project information',
    description:
      'Architecture, performance numbers, tech stack, and canonical demo views for Battery Market Maker.',
  })

  return (
    <div className="flex-1 max-w-[1100px] mx-auto px-6 py-10 w-full space-y-8">
      <header>
        <div className="text-xs mono uppercase tracking-widest text-accent mb-2">
          Project information
        </div>
        <h1 className="text-3xl font-semibold text-text-1 mb-3">
          Battery Market Maker
        </h1>
        <p className="text-base text-text-2 leading-relaxed max-w-3xl">
          A multi-period DC-OPF simulator for grid-scale batteries and AI data
          centers, with a Stackelberg market-maker mode that quantifies the dollar
          value of a hyperscaler accounting for its own LMP impact, plus a GPU
          cluster cost calculator that ranks 12 regions for siting decisions.
        </p>
        <p className="text-xs text-text-3 mt-3 mono">
          Ian Kleimans, Industrial Engineering, Purdue University. Final project
          for IE 590 — Energy Systems in the Age of AI, Spring 2026, Dr. Andrew
          L. Liu.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-text-1 uppercase tracking-wider mb-3">
          What it does
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded bg-accent/15 flex items-center justify-center text-accent shrink-0"
                  aria-hidden
                >
                  {f.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-1">{f.title}</div>
                  <div className="text-xs text-text-2 mt-0.5">{f.body}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-1 uppercase tracking-wider mb-3">
          Architecture
        </h2>
        <Card className="p-4">
          <pre className="text-[11px] mono text-text-2 leading-relaxed overflow-x-auto">{`┌─────────────────────┐   HTTPS    ┌──────────────────────────┐   sys.path   ┌─────────────┐
│  Vercel             │ ─────────▶ │  Railway                 │ ───────────▶ │  src/       │
│  (React 19 + Vite)  │            │  FastAPI + cvxpy/HiGHS   │              │  research   │
│  frontend/          │ ◀───── WS ─┤  backend/                │              │  policies   │
└─────────────────────┘            └──────────────────────────┘              └─────────────┘
        ▲                                    │                                      │
        │                                    ▼                                      ▼
        │                        ┌──────────────────────────┐         ┌────────────────────┐
        │                        │  PJM Data Miner 2 (LMP   │         │  XGBoost forecast  │
        │                        │  + reg cap / perf prices)│         │  + benchmark suite │
        │                        └──────────────────────────┘         └────────────────────┘
        │
        ▼
┌──────────────────────┐    keyboard chord    ┌────────────────────┐
│  Light / dark theme  │ ◀────── Cmd+Shift+S ─│  Screenshot mode   │
│  (CSS vars, no FOUC) │                      │  (chrome-less)     │
└──────────────────────┘                      └────────────────────┘`}</pre>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-1 uppercase tracking-wider mb-3">
          Performance & coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PERF.map((p) => (
            <Card key={p.label} className="p-3">
              <CardSubtitle>{p.label}</CardSubtitle>
              <div className="text-2xl font-semibold mono tabular-nums text-text-1 mt-1">
                {p.value}
              </div>
              <div className="text-[11px] text-text-2 mt-0.5">{p.detail}</div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-1 uppercase tracking-wider mb-3">
          Tech stack
        </h2>
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {STACK.map((s) => (
              <div key={s.area}>
                <div className="text-[10px] uppercase tracking-wider text-text-3 mono mb-1">
                  {s.area}
                </div>
                <div className="text-text-1">{s.items.join(', ')}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-1 uppercase tracking-wider mb-3">
          Canonical views
        </h2>
        <Card className="p-4">
          <p className="text-xs text-text-2 mb-3">
            Cmd/Ctrl+Shift+S inside the app toggles screenshot mode (hides chrome).
            The views below are the ones to look at first when evaluating the work.
          </p>
          <ul className="text-xs text-text-1 space-y-1.5">
            {CAPTURES.map((c) => (
              <li key={c.label} className="flex items-baseline gap-2">
                <Link
                  to={c.to}
                  className="text-accent hover:text-accent-hover mono inline-flex items-center gap-1 min-w-[180px]"
                >
                  {c.label} <ArrowRight size={11} />
                </Link>
                <span className="text-text-2">{c.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <footer className="pt-2 flex flex-wrap items-center gap-3 text-xs">
        <a
          href="https://github.com/IanKleimans/Battery-market-maker"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          <GitFork size={12} /> source
        </a>
        <Link to="/about" className="inline-flex items-center gap-1 text-accent hover:underline">
          <ExternalLink size={12} /> methodology
        </Link>
      </footer>
    </div>
  )
}

const FEATURES = [
  {
    icon: <Battery size={18} />,
    title: 'Multi-period DC-OPF on real test systems',
    body: 'IEEE 5/14/30-bus, batteries + AI campuses + renewables, LMPs from cvxpy duals.',
  },
  {
    icon: <Sparkles size={18} />,
    title: 'Stackelberg market-maker mode',
    body: 'Compares price-taker vs market-aware dispatch for a 500 MW campus and quantifies the dollar gain.',
  },
  {
    icon: <CalculatorIcon size={18} />,
    title: 'GPU cluster cost calculator',
    body: '12 regions, 5 GPU models, optional storage / DR revenue, PDF + CSV export.',
  },
  {
    icon: <TrendingUp size={18} />,
    title: 'Policy comparison dashboard',
    body: 'Perfect Foresight vs MPC vs Myopic on six test windows with hover crosshair and final-value annotations.',
  },
  {
    icon: <Cpu size={18} />,
    title: 'Show calculations everywhere',
    body: 'Inline KaTeX formulas + binding constraints + dual values exposed at every result the simulator shows.',
  },
  {
    icon: <Server size={18} />,
    title: 'Production-deployed full stack',
    body: 'Vercel frontend, Railway FastAPI backend, GitHub Actions CI, MIT license, 56 + 37 tests green.',
  },
]

const PERF = [
  {
    label: 'Live solve',
    value: '< 200 ms',
    detail: 'IEEE 14-bus single-period DC-OPF',
  },
  {
    label: 'Multi-period',
    value: '~ 2-5 s',
    detail: '24-hour horizon, IEEE 14-bus, all assets',
  },
  {
    label: 'Backend tests',
    value: '37',
    detail: 'pytest, 100% pass',
  },
  {
    label: 'Frontend tests',
    value: '56',
    detail: 'Vitest, 100% pass',
  },
]

const STACK = [
  {
    area: 'Backend',
    items: ['FastAPI', 'cvxpy', 'HiGHS', 'pydantic v2', 'XGBoost', 'numpy', 'pandas'],
  },
  {
    area: 'Frontend',
    items: [
      'React 19',
      'TypeScript',
      'Vite',
      'Tailwind 3',
      'Framer Motion',
      'D3',
      'Recharts',
      'Radix UI',
      'KaTeX',
      'jsPDF',
    ],
  },
  {
    area: 'Infrastructure',
    items: ['Vercel', 'Railway', 'GitHub Actions CI', 'MIT license'],
  },
  {
    area: 'Data',
    items: ['PJM Data Miner 2 API', 'EIA Form 861', 'Eurostat NRG_PC_205', 'NREL eGRID', 'IEA carbon intensity'],
  },
]

const CAPTURES = [
  { label: 'Simulator (Live)', to: '/simulator/pro', detail: 'IEEE 14-bus with flowing power and LMP heatmap' },
  { label: 'Simulator (Optimization)', to: '/simulator/pro', detail: '24-hour dispatch with battery + AI campus' },
  { label: 'Market-Maker mode', to: '/simulator/pro', detail: 'Stackelberg gain + per-bus LMP impact table' },
  { label: 'Dashboard', to: '/dashboard', detail: 'PF / MPC / Myopic comparison with annotations' },
  { label: 'Calculator', to: '/calculator', detail: '1M H100s in Texas vs Virginia, ranked' },
  { label: 'About / methodology', to: '/about', detail: 'KaTeX formulas + cite this project' },
]
