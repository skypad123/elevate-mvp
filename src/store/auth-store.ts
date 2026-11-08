import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS, storage } from './store-utils'

/** Mock token. A real app would receive one from its authentication API. */
export const MOCK_AUTH_TOKEN = 'mock_auth_token'

export interface AuthStore {
  token: string | null
  signIn: () => void
  signOut: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      signIn: () => set({ token: MOCK_AUTH_TOKEN }),
      signOut: () => set({ token: null }),
    }),
    {
      name: STORAGE_KEYS.auth,
      storage,
      // Hydrated by bootstrapStores() once the storage migrations have run
      skipHydration: true,
      partialize: (state) => ({ token: state.token }),
    }
  )
)

export const selectIsAuthenticated = (state: AuthStore) => state.token !== null
