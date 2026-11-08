import { ChevronUp } from 'lucide-react'
import { cn } from '../lib/cn'

export function Logo({
  suffix,
  size = 'md',
  className,
}: {
  suffix?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box =
    size === 'lg'
      ? 'size-10 rounded-control'
      : size === 'sm'
        ? 'size-6 rounded-sm'
        : 'size-8 rounded-sm'
  const word = size === 'lg' ? 'text-h1' : size === 'sm' ? 'text-h3' : 'text-h2'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('inline-flex items-center justify-center bg-brand text-brand-ink', box)}>
        <ChevronUp className="size-[65%]" strokeWidth={3} />
      </span>
      <span className={cn('font-display font-semibold tracking-tight text-ink', word)}>
        Elevate
      </span>
      {suffix ? (
        <span
          className={cn(
            'font-sans font-medium text-ink-secondary',
            size === 'lg' ? 'text-h3' : 'text-body',
          )}
        >
          {suffix}
        </span>
      ) : null}
    </span>
  )
}
