import { useEffect, useState } from 'react'

const read = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : (navigator.languages ?? [])

/** The browser's languages, most preferred first; updated when the browser says they changed. */
export function useDeviceLanguages(): readonly string[] {
  const [languages, setLanguages] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
    const onChange = () => setLanguages(read())
    window.addEventListener('languagechange', onChange)
    return () => window.removeEventListener('languagechange', onChange)
  }, [])
  return languages
}
