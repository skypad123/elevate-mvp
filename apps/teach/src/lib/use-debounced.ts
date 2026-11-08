import { useEffect, useRef } from 'react'

/** Returns a stable function that runs `fn` after `ms` of inactivity (latest args win). */
// biome-ignore lint/suspicious/noExplicitAny: generic callback wrapper
export function useDebounced<T extends (...args: any[]) => void>(fn: T, ms = 600): T {
  const timer = useRef<number | null>(null)
  const latest = useRef(fn)
  latest.current = fn
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )
  return ((...args: Parameters<T>) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => latest.current(...args), ms)
  }) as T
}
