import {
  PREFERENCES_STORAGE_KEY,
  type Preferences,
  parseStoredPreferences,
  serializePreferences,
} from '@elevate/core'

export type PreferencesStore = {
  key: string
  /** Synchronous so the first render already has the stored values (no theme flash). */
  read(): Preferences
  write(preferences: Preferences): void
}

/** localStorage-backed store; tolerant of private mode and corrupt data like `createTokenStore`. */
export function createPreferencesStore(key = PREFERENCES_STORAGE_KEY): PreferencesStore {
  return {
    key,
    read() {
      try {
        return parseStoredPreferences(window.localStorage.getItem(key))
      } catch {
        return parseStoredPreferences(null)
      }
    },
    write(preferences) {
      try {
        window.localStorage.setItem(key, serializePreferences(preferences))
      } catch {
        // private mode: the in-memory state still applies for this tab
      }
    },
  }
}
