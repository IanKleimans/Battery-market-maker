import { ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui'

export function About() {
  return (
    <div className="flex-1 max-w-[920px] mx-auto px-6 py-10 w-full">
      <h1 className="text-2xl font-semibold text-text-1 mb-2">About this project</h1>
      <p className="text-sm text-text-2 leading-relaxed">
        This is the deployed application companion to <em>Stochastic Dynamic
        Programming for Grid-Scale Battery Co-Optimization</em>, my IE 590
        project at Purdue Industrial Engineering. It extends the original
        single-asset SDP study (PF-LP / Myopic / MPC) with a multi-period DC-OPF
        on standard IEEE test systems, asset placement (batteries, AI campuses,
        renewables), and a real-time visualization layer.
      </p>

      <h2 className="text-base font-semibold text-text-1 mt-8 mb-2">Methodology</h2>
      <Card className="text-xs leading-relaxed text-text-2">
        At each timestep we solve a linear DC power-flow subproblem with batteries
        modeled as energy-bounded resources, flexible loads modeled with
        utilization in [flex_min, flex_max], and renewables modeled as
        injection minus a per-unit curtailment fraction. The full multi-period
        problem is jointly optimal over a 24-hour horizon at 1-hour resolution
        (or 5-minute for finer studies). LMPs are recovered from the duals of
        the nodal balance constraints.
      </Card>

      <h2 className="text-base font-semibold text-text-1 mt-8 mb-2">References</h2>
      <ul className="text-xs text-text-2 space-y-1.5">
        <li>Chen, Y. et al. — multistage stochastic dispatch in PJM/MISO contexts.</li>
        <li>Powell, W. — <em>Approximate Dynamic Programming</em>, Wiley.</li>
        <li>Schulman, J. et al. — policy gradient theorems used in the appendix.</li>
        <li>He, Liu, Chen — Stackelberg energy-pricing games for prosumer markets.</li>
      </ul>

      <h2 className="text-base font-semibold text-text-1 mt-8 mb-2">Acknowledgments</h2>
      <p className="text-xs text-text-2 leading-relaxed">
        Thanks to Dr. Andrew L. Liu and IE 590 (Purdue Industrial Engineering)
        for the framing and feedback that shaped this project. The PJM data path
        uses the public Data Miner 2 API.
      </p>

      <div className="mt-8 flex gap-3">
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
      </div>
    </div>
  )
}
