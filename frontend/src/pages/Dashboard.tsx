/** Analysis dashboard. Phase D implementation is light — Phase D fills it out. */

import { MetricCard } from '@/components/ui'

export function Dashboard() {
  return (
    <div className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-1">Analysis Dashboard</h1>
        <p className="text-sm text-text-2 mt-1">
          SDP policy comparison: Perfect Foresight vs MPC vs Myopic on synthetic and PJM data.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Revenue" value="—" unit="USD" loading />
        <MetricCard label="Optimality Gap" value="—" unit="%" loading />
        <MetricCard label="Forecast RMSE" value="—" unit="$/MWh" loading />
        <MetricCard label="Avg Solve Time" value="—" unit="s" loading />
      </div>
    </div>
  )
}
