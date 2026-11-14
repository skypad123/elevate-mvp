import {
  PREFERENCES_STORAGE_KEY,
  type Preferences,
  parseStoredPreferences,
  serializePreferences,
} from '@elevate/core'

/** Web: localStorage is synchronous, so the very first render already has the stored theme. */
function readSync(): Preferences {
  try {
    return parseStoredPreferences(window.localStorage.getItem(PREFERENCES_STORAGE_KEY))
  } catch {
    return parseStoredPreferences(null)
  }
}

export const preferencesStorage = {
  readSync,
  async read(): Promise<Preferences> {
    return readSync()
  },
  async write(preferences: Preferences): Promise<void> {
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(preferences))
    } catch {
      // private mode
    }
  },
}
