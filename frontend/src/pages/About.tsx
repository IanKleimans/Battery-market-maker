import { ExternalLink } from 'lucide-react'
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
          renewables), and a real-time visualization layer.
        </p>
      </header>

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
          <li>Chen, Y., Pan, F., Holzer, J. — multistage stochastic dispatch in PJM/MISO contexts.</li>
          <li>Powell, W. B. — <em>Approximate Dynamic Programming</em>, Wiley.</li>
          <li>Schulman, J., Levine, S., et al. — policy gradient methods (referenced in appendix).</li>
          <li>He, Liu, Chen — Stackelberg energy-pricing games for prosumer markets.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-1 mb-2">Acknowledgments</h2>
        <p className="text-xs text-text-2 leading-relaxed">
          Thanks to <strong className="text-text-1">Dr. Andrew L. Liu</strong> and
          IE 590 (Purdue Industrial Engineering) for the framing and feedback that
          shaped this project. The PJM data path uses the public Data Miner 2 API.
        </p>
      </section>

      <footer className="pt-4 flex gap-3">
        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs text-accent hover:underline"
        >
          GitHub <ExternalLink size={12} />
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
