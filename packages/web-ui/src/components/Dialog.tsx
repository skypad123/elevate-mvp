import { X } from 'lucide-react'
import { Dialog as RadixDialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useT } from '../preferences/PreferencesProvider'
import { Button } from './Button'

export type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const t = useT()
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=open]:animate-rise" />
        <RadixDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-6 shadow-float focus:outline-none data-[state=open]:animate-rise',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="font-display text-h2 font-semibold text-ink">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-body text-ink-secondary">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t('ui.close')}>
                <X className="size-5" />
              </Button>
            </RadixDialog.Close>
          </div>
          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
