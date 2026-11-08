import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const badge = cva(
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-caption font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-ink-secondary',
        brand: 'bg-brand-tint text-brand',
        accent: 'bg-accent-tint text-accent',
        success: 'bg-success-tint text-success',
        warning: 'bg-warning-tint text-warning',
        danger: 'bg-danger-tint text-danger',
        info: 'bg-info-tint text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>

export function Badge({ className, tone, ...rest }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...rest} />
}

export type StatusTone = NonNullable<BadgeProps['tone']>

export const statusTone: Record<string, StatusTone> = {
  draft: 'neutral',
  pending_review: 'warning',
  live: 'success',
  rejected: 'danger',
  applied: 'warning',
  approved: 'success',
  pending: 'neutral',
  processing: 'info',
  ready: 'success',
  errored: 'danger',
  active: 'success',
  pending_payment: 'warning',
  refunded: 'danger',
  cancelled: 'neutral',
  succeeded: 'success',
  partially_refunded: 'warning',
}

export function statusLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
