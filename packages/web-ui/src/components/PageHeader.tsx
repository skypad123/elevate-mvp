import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-h1 font-semibold text-ink">{title}</h1>
        {description ? (
          <div className="mt-2 max-w-2xl text-body text-ink-secondary">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary',
        className,
      )}
    >
      {children}
    </p>
  )
}
