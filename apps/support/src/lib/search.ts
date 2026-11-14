import { useDeferredValue, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

/**
 * A list's search text, kept in the address (`?q=`) so a reload, the back button and a shared
 * link keep it. Typing updates the box at once; the address and the query follow the settled
 * value, replacing the history entry instead of adding one per keystroke.
 */
export function useUrlSearch(): {
  q: string
  setQ: (q: string) => void
  /** The settled text to query with. */
  search: string
} {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const search = useDeferredValue(q).trim()
  useEffect(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (search) next.set('q', search)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [search, setParams])
  return { q, setQ, search }
}
