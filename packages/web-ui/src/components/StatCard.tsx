import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-card border border-border bg-surface p-5', className)}>
      <p className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
        {label}
      </p>
      <p className="mt-2 font-display text-h2 font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-small text-ink-secondary">{hint}</p> : null}
    </div>
  )
}

export function DescriptionList({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>
  className?: string
}) {
  return (
    <dl className={cn('grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-small', className)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-ink-tertiary">{item.label}</dt>
          <dd className="min-w-0 break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A date for display. `locale` is a BCP 47 tag; it defaults to English because most pages are
 * still English. A translated page uses `useFormatDate()` from `@elevate/web-ui/preferences`,
 * which passes the chosen language.
 */
export function formatDate(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale = 'en-SG',
): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(locale, options).format(new Date(iso))
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`
}
