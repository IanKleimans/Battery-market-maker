import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Zap, Battery, Brain } from 'lucide-react'
import { Card } from '@/components/ui'
import { usePageMeta } from '@/hooks/usePageMeta'

export function Landing() {
  usePageMeta({
    title: 'Battery Market Maker',
    description:
      'Interactive multi-period DC-OPF simulator for grid-scale batteries, AI data centers, and renewables on IEEE 5/14/30-bus test systems.',
  })
  return (
    <div className="flex-1 grid-bg">
      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-6 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          <div className="text-xs mono uppercase tracking-widest text-accent mb-3">
            IE 590 · Purdue Industrial Engineering
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold text-text-1 leading-tight tracking-tight">
            Battery Market Maker
          </h1>
          <p className="mt-4 text-lg text-text-2 max-w-2xl leading-relaxed">
            An interactive multi-period DC-OPF simulator for grid-scale batteries,
            flexible AI data centers, and renewables on the IEEE 5/14/30-bus test
            systems. Place assets, change forecasts, watch dispatch and LMPs evolve
            over a 24-hour horizon.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link
              to="/simulator/pro"
              className="inline-flex items-center gap-2 h-11 px-6 rounded bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Open simulator <ArrowRight size={16} />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 h-11 px-5 rounded border border-border text-text-1 text-sm hover:border-accent transition-colors"
            >
              <BookOpen size={16} /> Read the methodology
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-[1400px] mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            >
              <Card className="h-full">
                <div
                  className="w-9 h-9 rounded bg-accent/15 flex items-center justify-center text-accent mb-3"
                  aria-hidden
                >
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-text-1 mb-1">
                  {f.title}
                </h3>
                <p className="text-xs text-text-2 leading-relaxed">{f.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Built with */}
      <section className="max-w-[1400px] mx-auto px-6 pb-12">
        <div className="text-[10px] uppercase tracking-widest text-text-2 mono mb-3">
          Built with
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-2">
          {['FastAPI', 'cvxpy', 'HiGHS', 'React', 'D3', 'Tailwind', 'Framer Motion', 'PJM Data Miner'].map((t) => (
            <span key={t} className="mono">{t}</span>
          ))}
        </div>
      </section>
    </div>
  )
}

const features = [
  {
    icon: <Battery size={18} />,
    title: 'Multi-period DC-OPF',
    body: 'Full network optimization with batteries, flexible loads, and renewables — solved in cvxpy + HiGHS, LMPs from constraint duals.',
  },
  {
    icon: <Brain size={18} />,
    title: 'Stochastic co-optimization',
    body: 'Compare Perfect Foresight, Myopic Greedy, and MPC against XGBoost forecasts on synthetic and real PJM price data.',
  },
  {
    icon: <Zap size={18} />,
    title: 'Real PJM data',
    body: 'Auto-detected when present in the data directory; otherwise calibrated synthetic prices with daily/weekly seasonality.',
  },
]
