export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between text-[11px] text-text-2 mono">
        <div>
          <span>Battery Market Maker · IE 590 · Purdue Industrial Engineering</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/about"
            className="hover:text-text-1 transition-colors"
          >
            Methodology
          </a>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-1 transition-colors"
          >
            GitHub
          </a>
          <a
            href="/api/v1/health"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-1 transition-colors"
          >
            API
          </a>
        </div>
      </div>
    </footer>
  )
}
