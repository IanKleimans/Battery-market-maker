import { useState } from 'react'
import { Check, Copy, ExternalLink, GitFork } from 'lucide-react'
import { BlockMath, InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import { Card } from '@/components/ui'
import { usePageMeta } from '@/hooks/usePageMeta'

export function About() {
  usePageMeta({
    title: 'About',
    description:
      'Methodology, formulation, and references for the Battery Market Maker IE 590 project.',
  })
  return (
    <div className="flex-1 max-w-[920px] mx-auto px-6 py-10 w-full space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-text-1 mb-2">About this project</h1>
        <p className="text-sm text-text-2 leading-relaxed max-w-prose">
          Battery Market Maker is the deployed companion to{' '}
          <em>Stochastic Dynamic Programming for Grid-Scale Battery Co-Optimization</em>,
          my IE 590 project at Purdue Industrial Engineering. It extends the original
          single-asset SDP study (PF-LP / Myopic / MPC) with a multi-period DC-OPF on
          standard IEEE test systems, asset placement (batteries, AI campuses,
          renewables), a Stackelberg market-maker mode, and a GPU cluster cost
          calculator.
        </p>
      </header>

      <section>
        <h2 className="text-base font-semibold text-text-1 mb-3">Why I built this</h2>
        <Card className="text-sm leading-relaxed text-text-2 space-y-3">
          <p>
            I grew up in Campana, Argentina, on the Paraná River, ten minutes
            walking distance from the grain terminals where soybean barges leave for
            the world. Watching commodities physically move through that infrastructure
            shaped my sense of what economic activity actually looks like. It is not
            charts. It is barges, trains, transformers, transmission lines.
          </p>
          <p>
            Compute is the next commodity that needs that kind of physical accounting.
            I built Compute Tracker last year (now eight thousand monthly users) to
            give people a basic read on where GPU capacity sits and what it costs.
            Battery Market Maker is the same instinct one layer down: model the
            grid that the GPUs run on, in enough detail to ask the questions a real
            infrastructure planner has to ask. How much does this cluster cost in
            Texas vs Virginia. What happens to LMPs at this thinly-traded node when
            we drop a 500 MW campus on it. Does it pay to act like a market maker.
          </p>
          <p>
            Dr. Andrew L. Liu's research on Stackelberg games in energy markets,
            and the Purdue Grid of Tomorrow Consortium he co-leads with Amazon,
            NVIDIA, Tesla, and MISO, is exactly this question at the academic
            frontier. The market-maker mode in this project is my first pass at
            making those dynamics visceral on a real network. The next pass is
            the Lilly AI Fellowship, where I plan to push it further.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-1 mb-2">Multi-period DC-OPF</h2>
        <Card className="text-xs leading-relaxed text-text-2 space-y-3">
          <p>
            At each timestep <InlineMath math="t" />, we minimise system cost
            subject to a linear DC power-flow:
          </p>
          <BlockMath
            math={`\\min_{P_g, \\theta, f, c, d, E, u} \\sum_t \\Big[ \\sum_g \\text{cost}_g \\cdot P_{g,t} + \\sum_k \\kappa_k (c_{k,t} + d_{k,t}) - \\sum_j v_j \\cdot u_{j,t} C_{\\max,j} \\Big] \\Delta t`}
          />
          <p className="pt-1">subject to:</p>
          <BlockMath
            math={`f_{l,t} = \\frac{\\theta_{\\text{from}(l), t} - \\theta_{\\text{to}(l), t}}{x_l}, \\qquad |f_{l,t}| \\le \\bar f_l`}
          />
          <BlockMath
            math={`\\sum_{g \\in b} P_{g,t} + \\sum_{k \\in b} (d_{k,t} - c_{k,t}) - L_{b,t} - \\sum_{j \\in b} u_{j,t} C_{\\max,j} + \\sum_{r \\in b} (1 - \\xi_{r,t}) G_{r,t} = \\sum_{l: \\text{from}=b} f_{l,t} - \\sum_{l: \\text{to}=b} f_{l,t}`}
          />
          <BlockMath
            math={`E_{k,t+1} = E_{k,t} + \\eta_c \\, c_{k,t} \\Delta t - \\frac{d_{k,t}}{\\eta_d} \\Delta t, \\qquad 0 \\le E_{k,t} \\le \\bar E_k`}
          />
          <p>
            LMPs at each bus are recovered from the dual variables of the
            nodal-balance constraints: <InlineMath math="\\lambda_{b,t} = -\\partial L^* / \\partial L_{b,t}" />.
            Curtailment <InlineMath math="\\xi_{r,t} \\in [0, 1]" /> and DC
            utilisation <InlineMath math="u_{j,t} \\in [\\underline u_j, \\bar u_j]" />.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-1 mb-2">SDP policies (single asset)</h2>
        <Card className="text-xs leading-relaxed text-text-2 space-y-3">
          <p>
            For the single-battery case we evaluate three policies on synthetic and real PJM prices:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong>Perfect Foresight LP</strong> — solves the full
              48-hour LP with realised prices, providing an upper bound on
              attainable revenue.
            </li>
            <li>
              <strong>MPC</strong> — at each step, forecast the next{' '}
              <InlineMath math="H" /> intervals (XGBoost or persistence) and
              re-solve the LP starting from the current SOC.
            </li>
            <li>
              <strong>Myopic Greedy</strong> — single-step LP at every interval,
              no forecast lookahead.
            </li>
          </ul>
          <p>
            Optimality gap is reported as
            {' '}
            <InlineMath math="\\Delta = (R^{\\text{PF}} - R^{\\pi}) / R^{\\text{PF}}" />.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-1 mb-2">Data</h2>
        <Card className="text-xs leading-relaxed text-text-2 space-y-2">
          <p>
            Real-time LMPs and regulation clearing prices come from PJM's Data
            Miner 2 API. The current dataset is{' '}
            <span className="mono text-text-1">AEP-DAYTON HUB (pnode 34497127)</span>{' '}
            with five-minute prices for March 28 – April 27, 2026 (≈8,900 rows
            for LMPs; ≈8,400 rows for regulation prices). Regulation prices use
            the post-2025 redesigned schema
            (<code className="mono">capability_clearing_price</code> /
            <code className="mono">performance_clearing_price</code>).
          </p>
          <p>
            When real CSVs aren't present, the simulator falls back to a calibrated
            synthetic generator (daily/weekly seasonality with 2–3 spikes/week) so
            the demo still works.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-1 mb-2">References</h2>
        <ul className="text-xs text-text-2 space-y-1.5">
          <li>He, Liu, Chen (2025) — Stackelberg Markov games for energy market mechanism design.</li>
          <li>Liu, A. L. — Approximate dynamic programming for residential / distributed energy management.</li>
          <li>Chen, Y., Pan, F., Holzer, J. — multistage stochastic dispatch in PJM/MISO contexts.</li>
          <li>Powell, W. B. — <em>Approximate Dynamic Programming</em>, Wiley.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-1 mb-2">Roadmap (open research extensions)</h2>
        <Card className="text-sm leading-relaxed text-text-2 space-y-2">
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              Full MPEC / KKT-folded Stackelberg solve at the IEEE 30-bus and
              larger scale, replacing the current iterative best-response.
            </li>
            <li>
              Multi-agent campuses competing for the same congested node, with
              learning-based best-response (PPO over the leader's dispatch policy).
            </li>
            <li>
              Stackelberg Markov games over stochastic ISO behavior, applying the
              Liu et al. (2025) framework to the AI-data-center-as-leader setting.
            </li>
            <li>
              Real-time co-optimization with an actual PJM-style bid stack rather
              than the analytical merit order used here.
            </li>
            <li>
              CO2-aware dispatch policies that price marginal grid carbon explicitly
              alongside the financial LMP.
            </li>
          </ul>
          <p className="pt-1">
            Continuation work will land at the Lilly AI Fellowship and beyond.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-1 mb-2">Acknowledgments</h2>
        <p className="text-sm text-text-2 leading-relaxed">
          Dr. Andrew L. Liu (advisor), Purdue Industrial Engineering, and the Purdue
          Grid of Tomorrow Consortium. The PJM data path uses the public Data Miner
          2 API.
        </p>
      </section>

      <CitationCard />

      <footer className="pt-4 flex flex-wrap gap-3">
        <a
          href="https://github.com/IanKleimans/Battery-market-maker"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs text-accent hover:underline"
        >
          <GitFork size={12} /> source on GitHub
        </a>
        <a
          href="/press"
          className="inline-flex items-center gap-2 text-xs text-accent hover:underline"
        >
          Press kit <ExternalLink size={12} />
        </a>
        <a
          href="/api/v1/health"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs text-accent hover:underline"
        >
          API health <ExternalLink size={12} />
        </a>
      </footer>
    </div>
  )
}

function CitationCard() {
  const [copied, setCopied] = useState<'bibtex' | 'chicago' | null>(null)
  const bibtex = `@misc{kleimans2026battery,
  author = {Kleimans, Ian},
  title  = {Battery Market Maker: Stochastic Dynamic Programming for
            Grid-Scale Battery Co-Optimization},
  year   = {2026},
  howpublished = {\\url{https://battery-market-maker.vercel.app}},
  note   = {IE 590 final project, Purdue Industrial Engineering,
            advised by Dr. Andrew L. Liu}
}`
  const chicago = `Kleimans, Ian. "Battery Market Maker: Stochastic Dynamic Programming for Grid-Scale Battery Co-Optimization." IE 590 final project, Purdue Industrial Engineering, 2026. https://battery-market-maker.vercel.app.`

  const copy = (key: 'bibtex' | 'chicago', text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1500)
    })
  }

  const shareUrl = encodeURIComponent('https://battery-market-maker.vercel.app')
  const shareText = encodeURIComponent(
    'Multi-period DC-OPF for batteries and AI data centers. Stackelberg market-maker mode. GPU cluster cost calculator across 12 regions.',
  )

  return (
    <section>
      <h2 className="text-base font-semibold text-text-1 mb-2">Cite this project</h2>
      <Card className="text-xs text-text-2 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase tracking-wider text-text-3">BibTeX</div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-text-2 hover:text-accent"
              onClick={() => copy('bibtex', bibtex)}
            >
              {copied === 'bibtex' ? <Check size={11} /> : <Copy size={11} />}
              {copied === 'bibtex' ? 'copied' : 'copy'}
            </button>
          </div>
          <pre className="bg-bg p-2 rounded text-[10px] mono whitespace-pre-wrap text-text-1 overflow-x-auto">
            {bibtex}
          </pre>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase tracking-wider text-text-3">Chicago</div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-text-2 hover:text-accent"
              onClick={() => copy('chicago', chicago)}
            >
              {copied === 'chicago' ? <Check size={11} /> : <Copy size={11} />}
              {copied === 'chicago' ? 'copied' : 'copy'}
            </button>
          </div>
          <p className="text-[11px] text-text-1 leading-relaxed">{chicago}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] uppercase tracking-wider text-text-3">Share</span>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border text-text-1 hover:border-accent transition-colors"
          >
            LinkedIn
          </a>
          <a
            href={`https://x.com/intent/post?url=${shareUrl}&text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border text-text-1 hover:border-accent transition-colors"
          >
            X
          </a>
        </div>
      </Card>
    </section>
  )
}
