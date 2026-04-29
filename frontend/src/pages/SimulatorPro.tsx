/** Pro simulator — full Phase C implementation goes here.
 * For Phase B we leave a styled placeholder so the route renders. */

import { Wand2 } from 'lucide-react'
import { Card } from '@/components/ui'

export function SimulatorPro() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-md text-center">
        <Wand2 className="text-accent mx-auto mb-3" />
        <h2 className="text-base font-semibold text-text-1 mb-1">
          Pro Simulator coming online
        </h2>
        <p className="text-xs text-text-2">
          The full IEEE 14-bus / 30-bus simulator with optimization mode loads in
          Phase C of the build. Backend endpoints are live — try
          <code className="mono mx-1 px-1 py-0.5 bg-bg rounded text-[11px]">/api/v1/networks</code>
          in the meantime.
        </p>
      </Card>
    </div>
  )
}
