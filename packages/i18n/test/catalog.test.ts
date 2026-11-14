import { describe, expect, it } from 'vitest'
import {
  catalogs,
  createTranslator,
  interpolate,
  localeNames,
  missingKeys,
  supportedLocales,
  translate,
} from '../src/index'
import { en, enAreas } from '../src/messages/en'
import { zhAreas } from '../src/messages/zh'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('catalogs', () => {
  it('exist for every supported locale, with a display name', () => {
    for (const locale of supportedLocales) {
      expect(catalogs[locale]).toBeDefined()
      expect(localeNames[locale]).toBeTruthy()
    }
  })

  it('never contain keys that English does not define', () => {
    for (const locale of supportedLocales) {
      for (const key of Object.keys(catalogs[locale])) expect(en).toHaveProperty(key)
    }
  })

  it('are fully translated for the agreed scope', () => {
    for (const locale of supportedLocales) {
      expect(missingKeys(locale), `${locale} is missing translations`).toEqual([])
    }
  })

  it('keep the same placeholders as English', () => {
    for (const locale of supportedLocales) {
      for (const [key, value] of Object.entries(catalogs[locale])) {
        expect(placeholders(value), `${locale}:${key}`).toEqual(
          placeholders(en[key as keyof typeof en]),
        )
      }
    }
  })

  it('have no empty strings', () => {
    for (const locale of supportedLocales) {
      for (const [key, value] of Object.entries(catalogs[locale]))
        expect(value.trim(), `${locale}:${key}`).not.toBe('')
    }
  })
})

describe('areas', () => {
  // A key defined in two areas is silently overwritten by the later one when they are spread.
  it.each([
    ['en', enAreas, en],
    ['zh', zhAreas, catalogs.zh],
  ] as const)(
    '%s: no key is defined in two areas, and every area is in the catalog',
    (_locale, areas, catalog) => {
      const keys = areas.flatMap((area) => Object.keys(area))
      const twice = keys.filter((key, index) => keys.indexOf(key) !== index)
      expect(twice).toEqual([])
      expect(keys.sort()).toEqual(Object.keys(catalog).sort())
    },
  )
})

describe('translate', () => {
  it('returns the locale string', () => {
    expect(translate('zh', 'nav.settings')).toBe('设置')
    expect(translate('en', 'nav.settings')).toBe('Settings')
    expect(createTranslator('zh')('prefs.title')).toBe('偏好设置')
  })

  it('falls back to English for an untranslated key', () => {
    const sparse = { en, zh: {} }
    expect(translate('zh', 'nav.settings', undefined, sparse)).toBe('Settings')
  })

  it('interpolates {vars} and leaves unknown placeholders alone', () => {
    expect(interpolate('Hi {name}, {count} new, {unknown}', { name: 'Ada', count: 2 })).toBe(
      'Hi Ada, 2 new, {unknown}',
    )
  })
})
