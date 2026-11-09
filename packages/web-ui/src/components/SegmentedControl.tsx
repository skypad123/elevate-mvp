import type { LucideIcon } from 'lucide-react'
import { ToggleGroup } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export type SegmentedOption<T extends string> = {
  value: T
  label: ReactNode
  icon?: LucideIcon
}

/** Single-choice toggle group with radio semantics; arrow keys move between segments. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  disabled,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedOption<T>[]
  className?: string
  disabled?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix emits '' when the active item is clicked again; keep the current value instead.
        if (next) onValueChange(next as T)
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        'inline-flex gap-1 rounded-control border border-border bg-surface-muted p-1',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="inline-flex items-center gap-1.5 rounded-sm px-3.5 py-1.5 text-small font-semibold text-ink-secondary transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-float"
        >
          {option.icon ? <option.icon className="size-4" strokeWidth={2} /> : null}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
