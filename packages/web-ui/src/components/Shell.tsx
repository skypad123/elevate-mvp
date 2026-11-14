import type { LucideIcon } from 'lucide-react'
import { Menu as MenuIcon, X } from 'lucide-react'
import { Dialog as RadixDialog } from 'radix-ui'
import { type ReactNode, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { cn } from '../lib/cn'
import { useT } from '../preferences/PreferencesProvider'
import { Logo } from './Logo'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** A count shown beside the label, such as changes waiting for approval. */
  badge?: number
  /** What the count means, for screen readers: "2 waiting for approval". */
  badgeLabel?: string
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
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
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span className="rounded-pill bg-warning-tint px-2 py-0.5 text-caption font-semibold text-ink">
              {item.badge}
              {item.badgeLabel ? <span className="sr-only"> {item.badgeLabel}</span> : null}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Portal chrome: a brand-tinted sidebar with the navigation and a footer (who is signed in, the
 * profile switcher, sign out). Below `md` the sidebar becomes a drawer opened from the header, so
 * the footer is reachable on a phone too.
 */
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
  const t = useT()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  // Close the drawer whenever the page changes, whatever caused it.
  useEffect(() => {
    if (pathname) setOpen(false)
  }, [pathname])
  const tint = tone === 'brand' ? 'bg-brand-tint/40' : 'bg-surface-muted'
  const waiting = items.reduce((n, item) => n + (item.badge ?? 0), 0)

  return (
    <div className="flex min-h-full">
      <aside
        className={cn('hidden w-[248px] shrink-0 flex-col border-r border-border md:flex', tint)}
      >
        <div className="px-5 pb-4 pt-6">
          <Logo size="sm" suffix={portal} />
        </div>
        <NavLinks items={items} />
        {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Logo size="sm" suffix={portal} />
          <RadixDialog.Root open={open} onOpenChange={setOpen}>
            <RadixDialog.Trigger asChild>
              <button
                type="button"
                aria-label={t('ui.menu.open')}
                className="relative rounded-control p-2 text-ink-secondary hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <MenuIcon className="size-5" />
                {waiting ? (
                  <span className="absolute right-1 top-1 size-2 rounded-full bg-warning" />
                ) : null}
              </button>
            </RadixDialog.Trigger>
            <RadixDialog.Portal>
              <RadixDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
              <RadixDialog.Content
                className={cn(
                  'fixed inset-y-0 left-0 z-50 flex w-[min(300px,85vw)] flex-col border-r border-border bg-canvas shadow-float focus:outline-none',
                )}
              >
                <div className={cn('flex flex-1 flex-col overflow-y-auto', tint)}>
                  <div className="flex items-center justify-between px-5 pb-4 pt-5">
                    <RadixDialog.Title asChild>
                      <div>
                        <Logo size="sm" suffix={portal} />
                      </div>
                    </RadixDialog.Title>
                    <RadixDialog.Close
                      aria-label={t('ui.close')}
                      className="rounded-control p-2 text-ink-secondary hover:bg-surface-muted hover:text-ink"
                    >
                      <X className="size-5" />
                    </RadixDialog.Close>
                  </div>
                  <RadixDialog.Description className="sr-only">{portal}</RadixDialog.Description>
                  <NavLinks items={items} onNavigate={() => setOpen(false)} />
                  {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
                </div>
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-10">{children}</main>
      </div>
    </div>
  )
}
