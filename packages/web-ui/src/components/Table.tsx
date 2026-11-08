import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-card border border-border bg-surface">
      <table className={cn('w-full border-collapse text-small', className)} {...rest} />
    </div>
  )
}
export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-muted text-left', className)} {...rest} />
}
export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...rest} />
}
export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-surface-muted/60', className)} {...rest} />
}
export function TH({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 font-mono text-eyebrow font-medium uppercase tracking-[0.08em] text-ink-tertiary',
        className,
      )}
      {...rest}
    />
  )
}
export function TD({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle text-ink', className)} {...rest} />
}
