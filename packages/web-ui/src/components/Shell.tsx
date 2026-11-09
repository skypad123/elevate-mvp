import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { cn } from '../lib/cn'
import { Logo } from './Logo'

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

/** Portal chrome: brand-tinted sidebar for Teach, neutral for Support; content column with max width. */
export function PortalShell({
  portal,
  items,
  footer,
  children,
  tone = 'brand',
}: {
  portal: string
  items: NavItem[]
  footer?: ReactNode
  children: ReactNode
  tone?: 'brand' | 'neutral'
}) {
  return (
    <div className="flex min-h-full">
      <aside
        className={cn(
          'hidden w-[248px] shrink-0 flex-col border-r border-border md:flex',
          tone === 'brand' ? 'bg-brand-tint/40' : 'bg-surface-muted',
        )}
      >
        <div className="px-5 pb-4 pt-6">
          <Logo size="sm" suffix={portal} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-control px-3 py-2.5 text-small font-semibold transition-colors',
                  isActive
                    ? 'bg-surface text-brand-fg shadow-float'
                    : 'text-ink-secondary hover:bg-surface/70 hover:text-ink',
                )
              }
            >
              <item.icon className="size-[18px]" strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Logo size="sm" suffix={portal} />
          <nav className="flex gap-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-control p-2',
                    isActive ? 'bg-brand-tint text-brand-fg' : 'text-ink-secondary',
                  )
                }
                aria-label={item.label}
              >
                <item.icon className="size-5" />
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-10">{children}</main>
      </div>
    </div>
  )
}
