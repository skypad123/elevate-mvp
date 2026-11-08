import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '../lib/cn'

export type ToastTone = 'success' | 'danger' | 'info'
export type ToastInput = {
  title: string
  description?: string
  tone?: ToastTone
  durationMs?: number
}
type ToastItem = ToastInput & { id: number }

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)
  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((t) => t.id !== id)),
    [],
  )
  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++counter.current
      setItems((list) => [...list, { ...input, id }])
      window.setTimeout(() => dismiss(id), input.durationMs ?? 4500)
    },
    [dismiss],
  )
  const value = useMemo(() => ({ toast }), [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => {
          const Icon =
            item.tone === 'success' ? CheckCircle2 : item.tone === 'danger' ? CircleAlert : Info
          return (
            <div
              key={item.id}
              className="pointer-events-auto flex items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-float animate-rise"
            >
              <Icon
                className={cn(
                  'mt-0.5 size-5 shrink-0',
                  item.tone === 'success'
                    ? 'text-success'
                    : item.tone === 'danger'
                      ? 'text-danger'
                      : 'text-info',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-small-strong font-semibold text-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-small text-ink-secondary">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-sm p-1 text-ink-tertiary hover:bg-surface-muted hover:text-ink"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
