import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, type StateStorage } from 'zustand/middleware'

/**
 * Storage keys of the persisted Zustand stores.
 * Legacy keys that migrations read from live in ./migrations.ts.
 */
export const STORAGE_KEYS = {
  planner: '@elevate/planner',
  auth: '@elevate/auth',
  profile: '@elevate/profile',
} as const

/**
 * AsyncStorage adapter for Zustand persist middleware
 */
const asyncStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await AsyncStorage.getItem(name)
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name)
  },
}

/**
 * Shared persist storage for every store. Values are JSON envelopes of the
 * form `{ state, version }`; see ./migrations.ts when converting legacy data.
 */
export const storage = createJSONStorage(() => asyncStorageAdapter)
