import type { PreferenceKey, Preferences } from '@elevate/core'
import { createTranslator, type Translator } from '@elevate/i18n'
import type { ColorScheme } from '@elevate/tokens'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPreferencesStore, type PreferencesStore } from './store'

export type PreferencesContextValue = {
  preferences: Preferences
  setPreference: <K extends PreferenceKey>(key: K, value: Preferences[K]) => void
  /** The scheme actually on screen: the explicit choice, or the OS scheme under `system`. */
  resolvedScheme: ColorScheme
  t: Translator
}

const Ctx = createContext<PreferencesContextValue | null>(null)

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const subscribeSystemScheme = (onChange: () => void) => {
  const mq = darkQuery()
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const getSystemScheme = (): ColorScheme => (darkQuery().matches ? 'dark' : 'light')
const getServerScheme = (): ColorScheme => 'light'

/**
 * Applies `data-theme` and `lang` to <html>. `system` removes the attribute so the
 * `prefers-color-scheme` rules in tokens.css take over. The index.html pre-paint script does the
 * same before React loads; this keeps it in sync afterwards.
 */
function applyToDocument(preferences: Preferences) {
  const root = document.documentElement
  if (preferences.theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = preferences.theme
  root.lang = preferences.locale
}

const defaultStore = createPreferencesStore()

export function PreferencesProvider({
  store = defaultStore,
  children,
}: {
  store?: PreferencesStore
  children: ReactNode
}) {
  const [preferences, setPreferences] = useState<Preferences>(() => store.read())
  const systemScheme = useSyncExternalStore(subscribeSystemScheme, getSystemScheme, getServerScheme)

  // Persist after every change (also normalises whatever was stored before) and apply to <html>.
  useEffect(() => {
    store.write(preferences)
    applyToDocument(preferences)
  }, [preferences, store])

  // Another tab changed the stored value: follow it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === store.key) setPreferences(store.read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [store])

  const setPreference = useCallback(<K extends PreferenceKey>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }, [])

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setPreference,
      resolvedScheme: preferences.theme === 'system' ? systemScheme : preferences.theme,
      t: createTranslator(preferences.locale),
    }),
    [preferences, setPreference, systemScheme],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}

/** Translator bound to the current language preference. */
export function useT(): Translator {
  return usePreferences().t
}

export function useResolvedScheme(): ColorScheme {
  return usePreferences().resolvedScheme
}
