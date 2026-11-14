import { cn } from '../lib/cn'

export function initialsOf(name: string | null | undefined, fallback = '?'): string {
  if (!name) return fallback
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || fallback
}

export function Avatar({
  name,
  url,
  size = 'md',
  className,
}: {
  name: string | null | undefined
  url?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dim =
    size === 'lg'
      ? 'size-14 text-h3'
      : size === 'sm'
        ? 'size-7 text-caption'
        : 'size-9 text-small-strong'
  if (url)
    return (
      <img src={url} alt={name ?? ''} className={cn('rounded-pill object-cover', dim, className)} />
    )
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-pill bg-brand-tint font-semibold text-brand-fg',
        dim,
        className,
      )}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}
