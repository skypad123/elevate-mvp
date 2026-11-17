import { describe, expect, it } from 'vitest'
import {
  defaultPreferences,
  parseStoredPreferences,
  preferencesSchema,
  serializePreferences,
} from '../src/contracts/preferences'

describe('parseStoredPreferences', () => {
  it('defaults the language to system, which means not chosen on this device', () => {
    expect(defaultPreferences.locale).toBe('system')
    expect(parseStoredPreferences({}).locale).toBe('system')
  })

  it('keeps a language stored before system existed, as a choice', () => {
    expect(parseStoredPreferences({ locale: 'en' }).locale).toBe('en')
    expect(parseStoredPreferences({ locale: 'zh' }).locale).toBe('zh')
    expect(parseStoredPreferences({ locale: 'system' }).locale).toBe('system')
  })

  it('returns defaults for nothing stored', () => {
    expect(parseStoredPreferences(null)).toEqual(defaultPreferences)
    expect(parseStoredPreferences(undefined)).toEqual(defaultPreferences)
    expect(parseStoredPreferences({})).toEqual(defaultPreferences)
    expect(parseStoredPreferences('')).toEqual(defaultPreferences)
  })

  it('accepts a JSON string or an object', () => {
    const want = { theme: 'dark', locale: 'zh' }
    expect(parseStoredPreferences(JSON.stringify(want))).toEqual(want)
    expect(parseStoredPreferences(want)).toEqual(want)
  })

  it('never throws on garbage', () => {
    expect(parseStoredPreferences('{not json')).toEqual(defaultPreferences)
    expect(parseStoredPreferences([1, 2])).toEqual(defaultPreferences)
    expect(parseStoredPreferences(42)).toEqual(defaultPreferences)
    expect(parseStoredPreferences('"a string"')).toEqual(defaultPreferences)
  })

  it('drops unknown keys from older or newer app versions', () => {
    const parsed = parseStoredPreferences({ theme: 'light', future: true, locale: 'en' })
    expect(parsed).toEqual({ theme: 'light', locale: 'en' })
    expect('future' in parsed).toBe(false)
  })

  it('falls back per field, keeping the valid ones', () => {
    expect(parseStoredPreferences({ theme: 'neon', locale: 'zh' })).toEqual({
      theme: 'system',
      locale: 'zh',
    })
    expect(parseStoredPreferences({ theme: 'dark', locale: 'klingon' })).toEqual({
      theme: 'dark',
      locale: 'system',
    })
  })

  it('round-trips through serializePreferences', () => {
    const prefs = { theme: 'dark', locale: 'zh' } as const
    expect(parseStoredPreferences(serializePreferences(prefs))).toEqual(prefs)
  })
})

describe('preferencesSchema', () => {
  it('gives every field a default so new fields never break stored data', () => {
    for (const [key, field] of Object.entries(preferencesSchema.shape)) {
      expect(field.safeParse(undefined).success, `${key} needs a .default()`).toBe(true)
    }
  })
})
