import { defaultPreferences, type PreferenceKey, type Preferences } from '@elevate/core'
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
  t: Translator
}

const Ctx = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: PropsWithChildren) {
  const initial = useMemo(() => preferencesStorage.readSync(), [])
  const [preferences, setPreferences] = useState<Preferences>(initial ?? defaultPreferences)
  const [ready, setReady] = useState(initial !== null)

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

  // Web only: keep <html lang> in step with the language preference (the template ships "en").
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined')
      document.documentElement.lang = preferences.locale
  }, [preferences.locale])

  const setPreference = useCallback(<K extends PreferenceKey>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }, [])

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      ready,
      setPreference,
      t: createTranslator(preferences.locale),
    }),
    [preferences, ready, setPreference],
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
