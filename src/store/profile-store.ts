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
      onRehydrateStorage: () => (state) => {
        // Set isLoading to false once hydration is complete
        if (state) {
          state.isLoading = false
        }
      },
    }
  )
)
