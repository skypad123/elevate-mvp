import { Tabs as RadixTabs } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

export const Tabs = RadixTabs.Root

export function TabsList({ className, ...rest }: ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn(
        'inline-flex gap-1 rounded-control border border-border bg-surface-muted p-1',
        className,
      )}
      {...rest}
    />
  )
}

export function TabsTrigger({ className, ...rest }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'rounded-sm px-3.5 py-1.5 text-small font-semibold text-ink-secondary transition-colors hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-float',
        className,
      )}
      {...rest}
    />
  )
}

export function TabsContent({ className, ...rest }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn('mt-6 focus:outline-none', className)} {...rest} />
}
