import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserProfile } from '../types'
import { STORAGE_KEYS } from './store-utils'

/**
 * Keys written by earlier versions of the app. Only migrations read them.
 */
export const LEGACY_KEYS = {
  /** Misspelled planner key from the first builds */
  planner: '@elvate/planner',
  /** Auth token written by the Context-based auth provider */
  auth: '@elevate_auth_token',
  /** Profile written by the Context-based profile provider */
  profile: '@elevate_profile',
} as const

type Migration = {
  /** Set to 'true' once the step ran. Keep ids stable so a step never re-runs. */
  flag: string
  run: () => Promise<void>
}

/**
 * Wraps a state slice in the envelope the persist middleware reads
 * (`createJSONStorage` parses `{ state, version }`). `version` stays explicit
 * so a future `version: 1` + `migrate` also picks these records up.
 */
function envelope(state: unknown): string {
  return JSON.stringify({ state, version: 0 })
}

/**
 * Reads the legacy auth value in both formats earlier builds wrote: the raw
 * token string from the Context provider, or a persist envelope
 * `{ state: { token } }` from interim Zustand builds that kept the old key.
 * Returns null for an envelope that holds no token (signed out).
 */
function parseLegacyToken(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const token = (parsed as { state?: { token?: unknown } }).state?.token
      return typeof token === 'string' ? token : null
    }
  } catch {
    // Not JSON: the value is the raw token itself
  }
  return raw
}

/**
 * Reads the legacy profile in both formats earlier builds wrote: the raw
 * `{ name, imageUri? }` object, or a persist envelope `{ state: { profile } }`.
 * Returns undefined when nothing usable is found.
 */
function parseLegacyProfile(raw: string): UserProfile | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    const candidate =
      (parsed as { state?: { profile?: unknown } } | null)?.state?.profile ?? parsed
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      typeof (candidate as { name?: unknown }).name === 'string'
    ) {
      const { name, imageUri } = candidate as { name: string; imageUri?: unknown }
      return typeof imageUri === 'string' ? { name, imageUri } : { name }
    }
  } catch {
    // Unreadable legacy profile: fall through and drop it
  }
  return undefined
}

const migrations: Migration[] = [
  {
    // Existing flag id: installs that already ran this step must not run it again.
    flag: '@elevate/migration_v1_complete',
    run: async () => {
      const legacy = await AsyncStorage.getItem(LEGACY_KEYS.planner)
      if (legacy === null) return
      if ((await AsyncStorage.getItem(STORAGE_KEYS.planner)) === null) {
        await AsyncStorage.setItem(STORAGE_KEYS.planner, legacy)
      }
      await AsyncStorage.removeItem(LEGACY_KEYS.planner)
    },
  },
  {
    // Auth and profile moved from Context providers to persisted Zustand stores.
    flag: '@elevate/migration_v2_complete',
    run: async () => {
      const [legacyAuth, legacyProfile, auth, profile] = await Promise.all([
        AsyncStorage.getItem(LEGACY_KEYS.auth),
        AsyncStorage.getItem(LEGACY_KEYS.profile),
        AsyncStorage.getItem(STORAGE_KEYS.auth),
        AsyncStorage.getItem(STORAGE_KEYS.profile),
      ])

      if (legacyAuth !== null) {
        const token = parseLegacyToken(legacyAuth)
        if (auth === null && token !== null) {
          await AsyncStorage.setItem(STORAGE_KEYS.auth, envelope({ token }))
        }
        await AsyncStorage.removeItem(LEGACY_KEYS.auth)
      }

      if (legacyProfile !== null) {
        if (profile === null) {
          const parsed = parseLegacyProfile(legacyProfile)
          if (parsed) {
            await AsyncStorage.setItem(STORAGE_KEYS.profile, envelope({ profile: parsed }))
          }
        }
        await AsyncStorage.removeItem(LEGACY_KEYS.profile)
      }
    },
  },
]

/**
 * Runs every migration that has not completed yet, in order. Each step is
 * idempotent and never overwrites data already present at its destination, so
 * a failed step (flag left unset) is simply retried on the next launch.
 * Must finish before any store rehydrates; see ./bootstrap.ts.
 */
export async function runStorageMigrations(): Promise<void> {
  for (const { flag, run } of migrations) {
    try {
      if (await AsyncStorage.getItem(flag)) continue
      await run()
      await AsyncStorage.setItem(flag, 'true')
    } catch (error) {
      console.error(`Storage migration failed (${flag}):`, error)
    }
  }
}
