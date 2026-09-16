import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist } from './store-utils'
import { storage } from './store-utils'

const AUTH_KEY = '@elevate_auth_token'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isLoading: true,

      signIn: async () => {
        try {
          // Mock token - in real app this would come from authentication API
          await AsyncStorage.setItem(AUTH_KEY, 'mock_auth_token')
          set({ isAuthenticated: true })
        } catch (error) {
          console.error('Error signing in:', error)
          throw error
        }
      },

      signOut: async () => {
        try {
          await AsyncStorage.removeItem(AUTH_KEY)
          set({ isAuthenticated: false })
        } catch (error) {
          console.error('Error signing out:', error)
          throw error
        }
      },
    }),
    {
      name: AUTH_KEY,
      storage,
      onRehydrateStorage: () => (state) => {
        // Once rehydration is complete, set isLoading to false
        if (state) {
          state.isLoading = false
        }
      },
    }
  )
)
