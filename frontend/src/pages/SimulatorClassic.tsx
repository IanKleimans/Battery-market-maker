/** Classic 5-bus simulator. Placeholder for Phase C — embeds the existing
 * realtime_simulator_v2.html via iframe so the experience is preserved. */

export function SimulatorClassic() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-surface/40 text-xs text-text-2 flex items-center justify-between">
        <span>5-Bus Classic — preserved from the original simulator.</span>
        <a
          href="/simulator/pro"
          className="text-accent hover:underline"
        >
          Try the Pro simulator →
        </a>
      </div>
      <iframe
        title="Classic 5-bus simulator"
        src="/realtime_simulator_v2.html"
        className="flex-1 w-full bg-bg"
      />
    </div>
  )
}
