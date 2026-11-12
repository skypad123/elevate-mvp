import { intlLocale } from '@elevate/i18n'
import { useCallback, useMemo } from 'react'
import { formatDate } from '../components/StatCard'
import { usePreferences } from './PreferencesProvider'

/** The BCP 47 tag for `Intl` formatting in the chosen language. */
export function useIntlLocale(): string {
  return intlLocale(usePreferences().preferences.locale)
}

/**
 * `formatDate` in the chosen language, for translated pages. `formatDate` on its own formats for
 * English.
 */
export function useFormatDate(): (
  iso: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
) => string {
  const locale = useIntlLocale()
  return useCallback((iso, options) => formatDate(iso, options, locale), [locale])
}

/** Joins a list the way the chosen language does: "a, b and c" in English, "a、b和c" in Chinese. */
export function useFormatList(): (items: readonly string[]) => string {
  const locale = useIntlLocale()
  return useMemo(() => {
    const format = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })
    return (items) => format.format(items)
  }, [locale])
}
