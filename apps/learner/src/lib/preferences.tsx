import {
  defaultPreferences,
  type Locale,
  type PreferenceKey,
  type Preferences,
  resolveLocale,
} from '@elevate/core'
import { createTranslator, type Translator } from '@elevate/i18n'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Platform } from 'react-native'
import { preferencesStorage } from './preferences-storage'

export type PreferencesContextValue = {
  preferences: Preferences
  /** False until the stored values have been read (native only; web reads synchronously). */
  ready: boolean
  setPreference: <K extends PreferenceKey>(key: K, value: Preferences[K]) => void
  /** The language the UI shows: `resolveLocale` over the stored choice, account, `?lang` and device. */
  locale: Locale
  /** The signed-in account's language when a person chose it, else null. Set by the session. */
  setAccountLocale: (locale: Locale | null) => void
  t: Translator
}

const Ctx = createContext<PreferencesContextValue | null>(null)

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined'

/** Web only: the `lang` query parameter of the page the tab opened on. It is never stored. */
function readLangParam(): string | null {
  if (!isWeb()) return null
  try {
    return new URLSearchParams(window.location.search).get('lang')
  } catch {
    return null
  }
}

/** Web: the browser's languages. Native reads none yet. */
function readDeviceLanguages(): readonly string[] {
  if (!isWeb() || typeof navigator === 'undefined') return []
  return navigator.languages ?? []
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const initial = useMemo(() => preferencesStorage.readSync(), [])
  const [preferences, setPreferences] = useState<Preferences>(initial ?? defaultPreferences)
  const [ready, setReady] = useState(initial !== null)
  const [account, setAccountLocale] = useState<Locale | null>(null)
  // Read once when the app first mounts in this tab, and held for the tab's life.
  const [param] = useState(readLangParam)
  const [deviceLanguages] = useState(readDeviceLanguages)

  useEffect(() => {
    if (initial !== null) return
    let cancelled = false
    preferencesStorage.read().then((stored) => {
      if (cancelled) return
      setPreferences(stored)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [initial])

  // Persist after every change once loaded (also normalises whatever was stored before).
  useEffect(() => {
    if (ready) void preferencesStorage.write(preferences)
  }, [preferences, ready])

  const locale = resolveLocale({ stored: preferences.locale, account, param, deviceLanguages })

  // Web only: keep <html lang> in step with the resolved language (the template ships "en").
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined')
      document.documentElement.lang = locale
  }, [locale])

  const setPreference = useCallback(<K extends PreferenceKey>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }, [])

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      ready,
      setPreference,
      locale,
      setAccountLocale,
      t: createTranslator(locale),
    }),
    [preferences, ready, setPreference, locale],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}

/** Translator bound to the resolved language. */
export function useT(): Translator {
  return usePreferences().t
}
