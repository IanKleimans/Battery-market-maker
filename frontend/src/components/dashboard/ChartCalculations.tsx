/** "Show calculations" expander for a Dashboard chart panel.
 *
 * Each instance is mounted inside a Card and renders the formal definition of
 * what the chart is plotting along with the data window in use. KaTeX renders
 * the math; the prose stays in Ian's voice (no em dashes, no AI prose). */

import { useState } from 'react'
import { ChevronDown, ChevronRight, FunctionSquare } from 'lucide-react'
import { BlockMath, InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'

export interface ChartCalculationsProps {
  title: string
  /** KaTeX-formatted block formula */
  formula: string
  /** Free-form description of what's being plotted and how (prose, no markdown) */
  notes: React.ReactNode
  /** Inline math snippets to define each variable used in the formula */
  variables?: Array<{ symbol: string; meaning: string }>
  /** Where the underlying numbers come from */
  source: string
}

export function ChartCalculations({
  title,
  formula,
  notes,
  variables,
  source,
}: ChartCalculationsProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] mono text-text-2 hover:text-accent transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <FunctionSquare size={11} />
        Show calculations
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && (
        <div className="mt-2 p-3 bg-bg/60 border border-border rounded text-[11px] text-text-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-3">
            {title}
          </div>
          <div className="overflow-x-auto py-1">
            <BlockMath math={formula} />
          </div>
          {variables && variables.length > 0 && (
            <ul className="space-y-1 list-none">
              {variables.map((v) => (
                <li key={v.symbol} className="flex items-baseline gap-2">
                  <InlineMath math={v.symbol} />
                  <span>{v.meaning}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-text-2">{notes}</p>
          <p className="text-[10px] text-text-3 mono pt-1 border-t border-border">
            Source: {source}
          </p>
        </div>
      )}
    </div>
  )
}
