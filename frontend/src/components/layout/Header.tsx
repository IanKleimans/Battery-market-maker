import { NavLink } from 'react-router-dom'
import { Battery, GitFork } from 'lucide-react'
import { Badge, ThemeToggle } from '@/components/ui'
import { cn } from '@/lib/cn'

const navItems = [
  { to: '/simulator/pro', label: 'Simulator' },
  { to: '/simulator/classic', label: 'Classic' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/about', label: 'About' },
]

export function Header() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-surface/90 backdrop-blur-sm">
      <div className="flex items-center h-full px-4 gap-6 max-w-[1600px] mx-auto">
        <NavLink
          to="/"
          className="flex items-center gap-2 group"
          aria-label="Battery Market Maker home"
        >
          <Battery className="text-accent group-hover:scale-110 transition-transform" size={20} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-text-1">
              Battery Market Maker
            </div>
            <div className="text-[10px] text-text-2 mono">
              IE 590 · Purdue IE
            </div>
          </div>
        </NavLink>

        <nav className="flex items-center gap-1 ml-2" aria-label="Primary">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'px-3 h-7 inline-flex items-center text-xs rounded transition-colors',
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-text-2 hover:text-text-1 hover:bg-surface-hover',
                )
              }
            >
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        <Badge tone="success" className="hidden md:inline-flex">
          v2.0
        </Badge>

        <ThemeToggle />

        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          className="text-text-2 hover:text-text-1 transition-colors"
          aria-label="GitHub repository"
        >
          <GitFork size={18} />
        </a>
      </div>
    </header>
  )
}
