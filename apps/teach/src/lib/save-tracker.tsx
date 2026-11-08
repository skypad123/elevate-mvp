import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

type SaveState = { pending: number; lastSavedAt: number | null; failed: boolean }
type SaveTracker = SaveState & { track: <T>(promise: Promise<T>) => Promise<T> }

const Ctx = createContext<SaveTracker | null>(null)

/** Counts in-flight builder saves so the header can show “Saving…” / “All changes saved”. */
export function SaveTrackerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SaveState>({ pending: 0, lastSavedAt: null, failed: false })
  const inflight = useRef(0)
  const track = useCallback(async <T,>(promise: Promise<T>): Promise<T> => {
    inflight.current += 1
    setState((s) => ({ ...s, pending: inflight.current, failed: false }))
    try {
      const result = await promise
      inflight.current -= 1
      setState({ pending: inflight.current, lastSavedAt: Date.now(), failed: false })
      return result
    } catch (error) {
      inflight.current -= 1
      setState((s) => ({ ...s, pending: inflight.current, failed: true }))
      throw error
    }
  }, [])
  const value = useMemo(() => ({ ...state, track }), [state, track])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSaveTracker(): SaveTracker {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSaveTracker must be used inside SaveTrackerProvider')
  return ctx
}

export function SaveIndicator() {
  const { pending, lastSavedAt, failed } = useSaveTracker()
  if (pending > 0) return <span className="text-small text-ink-tertiary">Saving…</span>
  if (failed) return <span className="text-small text-danger">Some changes did not save</span>
  if (lastSavedAt) return <span className="text-small text-success">All changes saved</span>
  return null
}
