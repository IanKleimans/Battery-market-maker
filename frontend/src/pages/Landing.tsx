import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Battery,
  BookOpen,
  Calculator as CalculatorIcon,
  Cpu,
  GitFork,
  Server,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Card } from '@/components/ui'
import { usePageMeta } from '@/hooks/usePageMeta'

export function Landing() {
  usePageMeta({
    title: 'Battery Market Maker',
    description:
      'Interactive multi-period DC-OPF for batteries, AI data centers, and renewables. Stackelberg market-maker analysis. Site cost calculator for AI clusters across 12 regions.',
  })
  return (
    <div className="flex-1 grid-bg">
      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-6 py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          <div className="text-xs mono uppercase tracking-widest text-accent mb-3">
            IE 590 · Purdue Industrial Engineering · v3.0
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold text-text-1 leading-tight tracking-tight">
            Battery Market Maker
          </h1>
          <p className="mt-4 text-lg text-text-2 max-w-2xl leading-relaxed">
            Multi-period DC-OPF for grid-scale batteries, flexible AI data centers,
            and renewables on the IEEE 5/14/30-bus test systems. Now with a
            Stackelberg market-maker mode that quantifies how a 500 MW AI campus
            shifts local LMPs, and a GPU cluster cost calculator that ranks 12
            regions by annual electricity cost.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/simulator/pro"
              className="inline-flex items-center gap-2 h-11 px-6 rounded bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Open simulator <ArrowRight size={16} />
            </Link>
            <Link
              to="/calculator"
              className="inline-flex items-center gap-2 h-11 px-5 rounded border border-border text-text-1 text-sm hover:border-accent transition-colors"
            >
              <CalculatorIcon size={16} /> GPU cost calculator
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 h-11 px-5 rounded border border-border text-text-1 text-sm hover:border-accent transition-colors"
            >
              <BookOpen size={16} /> Methodology
            </Link>
          </div>
        </motion.div>
      </section>

      {/* What you can do here */}
      <section className="max-w-[1400px] mx-auto px-6 pb-12">
        <div className="text-[10px] uppercase tracking-widest text-text-2 mono mb-3">
          What you can do here
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {ACTIONS.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.06, duration: 0.4 }}
            >
              <Link
                to={a.to}
                className="block h-full p-4 rounded border border-border bg-surface/40 hover:border-accent hover:bg-surface-hover transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded bg-accent/15 flex items-center justify-center text-accent"
                    aria-hidden
                  >
                    {a.icon}
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-text-3 group-hover:text-accent transition-colors mt-1"
                  />
                </div>
                <h3 className="text-sm font-semibold text-text-1 mb-1">{a.title}</h3>
                <p className="text-xs text-text-2 leading-relaxed">{a.body}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* By the numbers */}
      <section className="max-w-[1400px] mx-auto px-6 pb-12">
        <div className="text-[10px] uppercase tracking-widest text-text-2 mono mb-3">
          By the numbers
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <Card key={s.label} className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-text-3 mono">
                {s.label}
              </div>
              <div className="text-2xl font-semibold mono tabular-nums text-text-1 mt-1">
                {s.value}
              </div>
              <div className="text-[11px] text-text-2 mt-0.5">{s.detail}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* The research question */}
      <section className="max-w-[1400px] mx-auto px-6 pb-12">
        <Card className="p-6 max-w-3xl">
          <div className="text-[10px] uppercase tracking-widest text-accent mono mb-2">
            The research question
          </div>
          <h2 className="text-xl font-semibold text-text-1 mb-3">
            How do AI data centers integrate with the grid as flexible market participants?
          </h2>
          <p className="text-sm text-text-2 leading-relaxed">
            Hyperscale training clusters at 500-1500 MW are large enough that their
            own dispatch decisions move the LMPs they pay. The price-taker assumption
            breaks. This project's market-maker mode demonstrates the gap by comparing
            a campus's revenue under price-taking vs Stackelberg-aware dispatch on
            the IEEE 14-bus system. The natural extension is the Stackelberg Markov
            game framework of Liu et al. (2025) for adaptive followers under
            stochastic ISO behavior.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Link
              to="/simulator/pro"
              className="text-xs text-accent hover:text-accent-hover mono inline-flex items-center gap-1"
            >
              Open Market Maker mode <ArrowRight size={12} />
            </Link>
            <span className="text-text-3 text-xs">·</span>
            <Link
              to="/about"
              className="text-xs text-text-2 hover:text-text-1 mono"
            >
              read the methodology
            </Link>
          </div>
        </Card>
      </section>

      {/* Built with */}
      <section className="max-w-[1400px] mx-auto px-6 pb-16">
        <div className="text-[10px] uppercase tracking-widest text-text-2 mono mb-3">
          Built with
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-2">
          {[
            'FastAPI',
            'cvxpy',
            'HiGHS',
            'React',
            'TypeScript',
            'D3',
            'Tailwind',
            'Framer Motion',
            'Recharts',
            'KaTeX',
            'PJM Data Miner',
            'Vercel',
            'Railway',
          ].map((t) => (
            <span key={t} className="mono">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3 text-xs text-text-3 mono">
          <a
            href="https://github.com/IanKleimans/Battery-market-maker"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-text-1 transition-colors"
          >
            <GitFork size={12} /> source on github
          </a>
          <span>·</span>
          <span>Ian Kleimans · advised by Dr. Andrew L. Liu · Purdue IE</span>
        </div>
      </section>
    </div>
  )
}

const ACTIONS = [
  {
    icon: <Battery size={18} />,
    title: 'Run a 24-hour battery dispatch on real PJM prices',
    body: 'Multi-period DC-OPF with batteries, AI campuses, and renewables on the IEEE 14-bus.',
    to: '/simulator/pro',
  },
  {
    icon: <TrendingUp size={18} />,
    title: 'Compare PF, MPC, and Myopic strategies',
    body: 'Six test windows, three policies, three forecasters. See the cost of forecast error.',
    to: '/dashboard',
  },
  {
    icon: <CalculatorIcon size={18} />,
    title: 'Estimate AI campus electricity cost across regions',
    body: '12 regions, 5 GPU models, optional storage / DR revenue. Export PDF and CSV.',
    to: '/calculator',
  },
  {
    icon: <Sparkles size={18} />,
    title: 'Watch a 500 MW data center move LMPs',
    body: 'Stackelberg market-maker analysis. See the price-taker baseline vs joint equilibrium.',
    to: '/simulator/pro',
  },
]

const STATS = [
  {
    label: 'Networks',
    value: '5/14/30',
    detail: 'bus topologies (5-bus, IEEE 14, IEEE 30)',
  },
  {
    label: 'Asset types',
    value: '3',
    detail: 'batteries, AI campuses, renewables',
  },
  {
    label: 'Backend tests',
    value: '37',
    detail: 'cvxpy + HiGHS + Pydantic, all green',
  },
  {
    label: 'Front tests',
    value: '56',
    detail: 'Vitest + Testing Library + JSDOM',
  },
]

// Re-export keeps the bundler happy when this file is imported eagerly.
export const _LANDING_HAS_CPU_ICON = Cpu
export const _LANDING_HAS_SERVER_ICON = Server
