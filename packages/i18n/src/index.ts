import { type Locale, supportedLocales } from '@elevate/core'
import { en } from './messages/en'
import { zh } from './messages/zh'
import type { MessageKey, Messages, MessageVars } from './types'

export type { Locale, MessageKey, Messages, MessageVars }
export { supportedLocales }

/**
 * One catalog per supported locale. `Record<Locale, …>` means adding a locale to
 * `supportedLocales` in @elevate/core fails typecheck until a catalog exists here.
 */
export const catalogs: Record<Locale, Partial<Messages>> = { en, zh }

/** Each language's name in that language — shown untranslated in the language picker. */
export const localeNames: Record<Locale, string> = { en: 'English', zh: '中文' }

/** BCP 47 tag for `Intl` formatting in a given UI locale. */
export function intlLocale(locale: Locale): string {
  return locale === 'zh' ? 'zh-SG' : 'en-SG'
}

const PLACEHOLDER = /\{(\w+)\}/g

/** Replace `{name}` placeholders; unknown placeholders are left in place. */
export function interpolate(template: string, vars: MessageVars): string {
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: MessageVars,
  source: Record<Locale, Partial<Messages>> = catalogs,
): string {
  const template = source[locale]?.[key] ?? en[key]
  return vars ? interpolate(template, vars) : template
}

export type Translator = (key: MessageKey, vars?: MessageVars) => string

export function createTranslator(locale: Locale): Translator {
  return (key, vars) => translate(locale, key, vars)
}

/** Keys a catalog has not translated yet (the test suite reports these). */
export function missingKeys(locale: Locale): MessageKey[] {
  const catalog = catalogs[locale]
  return (Object.keys(en) as MessageKey[]).filter((key) => !(key in catalog))
}
