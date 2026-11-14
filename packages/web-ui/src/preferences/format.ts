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

/**
 * Joins a list of names or titles with the chosen language's list comma: "a, b, c" in English,
 * "a、b、c" in Chinese. There is no "and" before the last item, on purpose: the items are often
 * what someone typed (lesson titles), and a word of one language between two titles of another
 * reads badly.
 */
export function useFormatList(): (items: readonly string[]) => string {
  const locale = useIntlLocale()
  return useMemo(() => {
    const format = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' })
    return (items) => format.format(items)
  }, [locale])
}
