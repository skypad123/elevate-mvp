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
          set({ isAuthenticated: true })
        } catch (error) {
          console.error('Error signing in:', error)
          throw error
        }
      },

      signOut: async () => {
        try {
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
      onRehydrateStorage: () => (state, error) => {
        useAuthStore.setState({ isLoading: false })
      },
    }
  )
)
