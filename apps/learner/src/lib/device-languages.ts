import { useLocales } from 'expo-localization'
import { useMemo } from 'react'

/**
 * The phone's languages, most preferred first, as BCP 47 tags (`zh-Hant-TW`, `en-SG`). The list
 * re-renders when the user changes it in the phone's settings.
 */
export function useDeviceLanguages(): readonly string[] {
  const locales = useLocales()
  return useMemo(() => locales.map((l) => l.languageTag), [locales])
}
