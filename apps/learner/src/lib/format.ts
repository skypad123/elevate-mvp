import type { Locale, Translator } from '@elevate/i18n'
import { intlLocale } from '@elevate/i18n'

export { formatSgd } from '@elevate/core'

/** A duration in the reader's language: "12 min", "1 h", "1 h 5 min". */
export function formatMinutes(seconds: number | null | undefined, t: Translator): string {
  if (!seconds) return ''
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return t('learnerCommon.duration.minutes', { minutes })
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest
    ? t('learnerCommon.duration.hoursMinutes', { hours, minutes: rest })
    : t('learnerCommon.duration.hours', { hours })
}

/** A date in the reader's language, through Intl ("17 Nov 2026", "2026年11月17日"). */
export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Items joined the reader's way: "a, b, c" in English, "a、b、c" in Chinese. */
export function formatList(items: readonly string[], t: Translator): string {
  return items.join(t('learnerCommon.list.separator'))
}
