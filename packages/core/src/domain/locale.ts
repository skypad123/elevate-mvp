import { type Locale, type LocalePreference, localeSchema } from '../contracts/preferences'

/**
 * The one language rule (ADR 010). In order:
 * 1. `stored`, when this device chose `en` or `zh`;
 * 2. `account`, the signed-in user's language, which callers pass only when a person chose it;
 * 3. `param`, a `?lang` value, when it is a supported locale;
 * 4. `zh`, when the first device language's primary subtag is `zh` (Traditional tags included);
 * 5. `en`.
 *
 * The pre-paint scripts (`public/preferences-init.js` in the learner app, Teach and Support) copy
 * rules 1, 4 and 5, because a classic script can't import. Change them together.
 */
export function resolveLocale(input: {
  stored: LocalePreference
  account?: Locale | null
  param?: string | null
  deviceLanguages: readonly string[]
}): Locale {
  if (input.stored !== 'system') return input.stored
  if (input.account) return input.account
  const param = localeSchema.safeParse(input.param)
  if (param.success) return param.data
  return primarySubtag(input.deviceLanguages[0]) === 'zh' ? 'zh' : 'en'
}

/** True when a person picked the language on this device; `system` is not a choice. */
export function isChosen(stored: LocalePreference): boolean {
  return stored !== 'system'
}

function primarySubtag(tag: string | undefined): string {
  return (tag ?? '').split('-')[0]?.toLowerCase() ?? ''
}
