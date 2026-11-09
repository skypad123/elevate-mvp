import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  body,
  action,
  tone = 'neutral',
  className,
}: {
  icon?: LucideIcon
  eyebrow?: string
  title: string
  body?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'danger'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-dashed bg-surface-muted px-6 py-12 text-center',
        tone === 'danger' ? 'border-danger' : 'border-border-strong',
        className,
      )}
    >
      {Icon ? (
        <Icon
          className={cn('size-7', tone === 'danger' ? 'text-danger' : 'text-brand-fg')}
          strokeWidth={1.8}
        />
      ) : null}
      {eyebrow ? (
        <p className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      {body ? <div className="max-w-md text-body text-ink-secondary">{body}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
