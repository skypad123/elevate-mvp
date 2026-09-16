import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

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
 * Storage instance for Zustand persist middleware
 */
export const storage = createJSONStorage(() => asyncStorageAdapter)

/**
 * Persist middleware type helper for Zustand stores
 */
export { persist }

// Migration flag to ensure it only runs once
const MIGRATION_FLAG_KEY = '@elevate/migration_v1_complete'

/**
 * One-time migration: fix misspelled key @elvate/planner → @elevate/planner
 * and migrate raw auth token to Zustand persist JSON format
 * This should be called once on app startup before any stores are initialized
 */
export async function runStorageMigrations(): Promise<void> {
  try {
    // Check if migration already ran
    const migrationComplete = await AsyncStorage.getItem(MIGRATION_FLAG_KEY)
    if (migrationComplete) {
      return
    }

    // Read the old misspelled key
    const oldKey = '@elvate/planner'
    const newKey = '@elevate/planner'
    
    const oldData = await AsyncStorage.getItem(oldKey)
    
    if (oldData !== null) {
      // Write to corrected key
      await AsyncStorage.setItem(newKey, oldData)
      
      // Remove the old key
      await AsyncStorage.removeItem(oldKey)
      
      console.log('Storage migration: moved @elvate/planner → @elevate/planner')
    }

    // Migrate auth token from raw string to Zustand persist JSON format
    const authKey = '@elevate_auth_token'
    const authData = await AsyncStorage.getItem(authKey)
    
    if (authData !== null) {
      try {
        // Try to parse as JSON - if it succeeds, it's already in the new format
        JSON.parse(authData)
      } catch {
        // Not valid JSON, so it's the old raw token format
        // Convert to Zustand persist format with isAuthenticated: true
        const zustandFormat = {
          state: {
            isAuthenticated: true,
            isLoading: false,
          },
          version: 0,
        }
        await AsyncStorage.setItem(authKey, JSON.stringify(zustandFormat))
        console.log('Storage migration: converted raw auth token to Zustand persist format')
      }
    }

    // Mark migration as complete
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true')
  } catch (error) {
    console.error('Error running storage migrations:', error)
    // Don't throw - let app continue even if migration fails
  }
}
