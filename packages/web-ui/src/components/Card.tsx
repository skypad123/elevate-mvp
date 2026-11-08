import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean
  muted?: boolean
  elevated?: boolean
  as?: 'div' | 'section' | 'article'
}

export function Card({
  className,
  padded = true,
  muted,
  elevated,
  as: Tag = 'div',
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-card border border-border bg-surface',
        padded && 'p-6',
        muted && 'bg-surface-muted',
        elevated && 'shadow-float',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div>
        <h3 className="text-h3 font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-1 text-small text-ink-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
