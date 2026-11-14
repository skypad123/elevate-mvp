import { z } from 'zod'

/**
 * Device-local user preferences shared by the three portals.
 *
 * Rules that keep this forward-compatible:
 * - Every field has a `.default()`, so `{}` and any older stored shape still parse.
 * - `parseStoredPreferences` is per-field and lenient: unknown keys are dropped and a value that
 *   no longer validates (e.g. a removed enum member) falls back to that field's default.
 * - To add a preference: add one field here with a default, then a control in the shared
 *   PreferencesCard (web) and the Profile Preferences card (learner). Nothing else changes.
 * - To add a language: append to `supportedLocales` and add a catalog in `@elevate/i18n`.
 */

export const supportedLocales = ['en', 'zh'] as const
export const localeSchema = z.enum(supportedLocales)
export type Locale = z.infer<typeof localeSchema>

export const themePreferenceSchema = z.enum(['system', 'light', 'dark'])
export type ThemePreference = z.infer<typeof themePreferenceSchema>

export const preferencesSchema = z.object({
  theme: themePreferenceSchema.default('system'),
  locale: localeSchema.default('en'),
})
export type Preferences = z.infer<typeof preferencesSchema>
export type PreferenceKey = keyof Preferences

export const defaultPreferences: Preferences = preferencesSchema.parse({})

/**
 * Storage key on every platform (localStorage on web, AsyncStorage on native).
 * Mirrored literally in the portals' pre-paint scripts (`public/preferences-init.js`); keep them
 * in sync.
 */
export const PREFERENCES_STORAGE_KEY = 'elevate.preferences'

const preferenceKeys = Object.keys(preferencesSchema.shape) as PreferenceKey[]

/**
 * Turn whatever was persisted (a JSON string, a parsed object, or garbage) into valid
 * preferences. Never throws; never returns anything but a complete `Preferences`.
 */
export function parseStoredPreferences(raw: unknown): Preferences {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      value = null
    }
  }
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const out: Record<string, unknown> = {}
  for (const key of preferenceKeys) {
    const parsed = preferencesSchema.shape[key].safeParse(source[key])
    out[key] = parsed.success ? parsed.data : defaultPreferences[key]
  }
  return out as Preferences
}

export function serializePreferences(preferences: Preferences): string {
  return JSON.stringify(preferences)
}
