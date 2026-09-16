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
      try {
        const parsed = JSON.parse(oldData)
        
        // Check if data is already in Zustand persist format (has state property)
        let migratedData: string
        if (parsed.state !== undefined) {
          // Already in new format, just copy it
          migratedData = oldData
        } else {
          // Old Context format: { courses, tasks }
          // Wrap it in Zustand persist envelope: { state: { courses, tasks, ready }, version: 0 }
          const wrapped = {
            state: {
              courses: parsed.courses || [],
              tasks: parsed.tasks || [],
              ready: false,
            },
            version: 0,
          }
          migratedData = JSON.stringify(wrapped)
        }
        
        // Write to corrected key
        await AsyncStorage.setItem(newKey, migratedData)
        
        // Remove the old key
        await AsyncStorage.removeItem(oldKey)
        
        console.log('Storage migration: moved @elvate/planner → @elevate/planner')
      } catch (error) {
        console.error('Error parsing old storage data:', error)
        // If parsing fails, just copy the raw data
        await AsyncStorage.setItem(newKey, oldData)
        await AsyncStorage.removeItem(oldKey)
      }
    }

    // Mark migration as complete
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true')
  } catch (error) {
    console.error('Error running storage migrations:', error)
    // Don't throw - let app continue even if migration fails
  }
}
