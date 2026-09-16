import { create } from 'zustand'
import { persist, storage } from './store-utils'

export interface UserProfile {
  name: string
  imageUri?: string
}

interface ProfileState {
  profile: UserProfile
  isLoading: boolean
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>
}

const defaultProfile: UserProfile = {
  name: 'Student',
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      isLoading: true,
      updateProfile: async (updates: Partial<UserProfile>) => {
        const currentProfile = get().profile
        const newProfile = { ...currentProfile, ...updates }
        set({ profile: newProfile })
      },
    }),
    {
      name: '@elevate_profile',
      storage,
      migrate: (persistedState: any, version: number) => {
        // Migrate old raw UserProfile format to new Zustand persist format
        if (persistedState && typeof persistedState === 'object' && !('profile' in persistedState)) {
          // Old format: { name, imageUri }
          // Convert to new format: { profile: { name, imageUri }, isLoading: false }
          return {
            profile: persistedState as UserProfile,
            isLoading: false,
            updateProfile: undefined as any, // Functions are not persisted
          }
        }
        // Already in new format or null/undefined
        return persistedState as ProfileState
      },
      onRehydrateStorage: () => (state) => {
        // Set isLoading to false once hydration is complete
        if (state) {
          state.isLoading = false
        }
      },
    }
  )
)
