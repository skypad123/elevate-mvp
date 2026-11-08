import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '../types'
import { STORAGE_KEYS, storage } from './store-utils'

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Student',
}

export interface ProfileStore {
  profile: UserProfile
  updateProfile: (updates: Partial<UserProfile>) => void
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,
      updateProfile: (updates) =>
        set((state) => ({ profile: { ...state.profile, ...updates } })),
    }),
    {
      name: STORAGE_KEYS.profile,
      storage,
      // Hydrated by bootstrapStores() once the storage migrations have run
      skipHydration: true,
      partialize: (state) => ({ profile: state.profile }),
    }
  )
)
