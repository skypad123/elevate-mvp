import {
  PREFERENCES_STORAGE_KEY,
  type Preferences,
  parseStoredPreferences,
  serializePreferences,
} from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Native: preferences live in AsyncStorage, which is async-only, so the provider shows nothing
 * until `read()` resolves (the splash screen covers that). See the `.web.ts` sibling for web.
 */
export const preferencesStorage = {
  /** No synchronous source on native. */
  readSync(): Preferences | null {
    return null
  },
  async read(): Promise<Preferences> {
    try {
      return parseStoredPreferences(await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY))
    } catch {
      return parseStoredPreferences(null)
    }
  },
  async write(preferences: Preferences): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(preferences))
    } catch {
      // storage full or unavailable: the in-memory value still applies this session
    }
  },
}
