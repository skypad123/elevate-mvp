import { type Locale, type PreferenceKey, type Preferences, resolveLocale } from '@elevate/core'
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
  /** The language actually on screen: the stored choice, or the browser's language under `system`. */
  locale: Locale
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

const deviceLanguages = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : navigator.languages

/**
 * Applies `data-theme` and `lang` to <html>. `system` removes the attribute so the
 * `prefers-color-scheme` rules in tokens.css take over. The pre-paint script
 * (`public/preferences-init.js` in each portal) does the same before React loads; this keeps it
 * in sync afterwards.
 */
function applyToDocument(theme: Preferences['theme'], locale: Locale) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme
  root.lang = locale
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
  // Teach and Support have no account language yet, so `system` follows the browser (ADR 010).
  const locale = useMemo(
    () => resolveLocale({ stored: preferences.locale, deviceLanguages: deviceLanguages() }),
    [preferences.locale],
  )

  // Persist after every change (also normalises whatever was stored before) and apply to <html>.
  useEffect(() => {
    store.write(preferences)
    applyToDocument(preferences.theme, locale)
  }, [preferences, locale, store])

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

  // `t` changes only with the language, so an effect or callback that depends on it is not re-run
  // by a theme change.
  const t = useMemo(() => createTranslator(locale), [locale])

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setPreference,
      resolvedScheme: preferences.theme === 'system' ? systemScheme : preferences.theme,
      locale,
      t,
    }),
    [preferences, setPreference, systemScheme, locale, t],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}

/** Translator bound to the language on screen. */
export function useT(): Translator {
  return usePreferences().t
}

export function useResolvedScheme(): ColorScheme {
  return usePreferences().resolvedScheme
}
