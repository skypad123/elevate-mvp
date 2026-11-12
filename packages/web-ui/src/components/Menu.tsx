import { Check } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '../lib/cn'

export type MenuEntry = {
  key: string
  label: string
  /** A second, quieter line: a role, a status. */
  detail?: string
  /** Where the entry goes. Entries are links, so they open in a new tab with a modifier key. */
  to: string
  current?: boolean
}

/**
 * A button that opens a list of links. For choices that take the user somewhere (switching
 * profile), where a native select would navigate on every arrow key.
 */
export function Menu({
  trigger,
  label,
  entries,
  footer,
  align = 'start',
}: {
  trigger: ReactNode
  /** Accessible name of the menu. */
  label: string
  entries: MenuEntry[]
  /** Extra entries under a separator, such as "Create a company profile". */
  footer?: MenuEntry[]
  align?: 'start' | 'end'
}) {
  const item = (entry: MenuEntry) => (
    <DropdownMenu.Item key={entry.key} asChild>
      <Link
        to={entry.to}
        aria-current={entry.current ? 'page' : undefined}
        className="flex cursor-pointer items-start gap-2 rounded-control px-3 py-2 text-small text-ink outline-none data-[highlighted]:bg-surface-muted"
      >
        <span className="mt-0.5 size-4 shrink-0 text-brand-fg">
          {entry.current ? <Check className="size-4" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{entry.label}</span>
          {entry.detail ? (
            <span className="block truncate text-caption text-ink-tertiary">{entry.detail}</span>
          ) : null}
        </span>
      </Link>
    </DropdownMenu.Item>
  )
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label={label}
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 max-h-[min(70vh,420px)] min-w-[240px] max-w-[320px] overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-float',
          )}
        >
          {entries.map(item)}
          {footer?.length ? (
            <>
              <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
              {footer.map(item)}
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
