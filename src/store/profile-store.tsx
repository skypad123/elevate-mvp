import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const PROFILE_KEY = '@elevate_profile'

export interface UserProfile {
  name: string
  imageUri?: string
}

interface ProfileContextValue {
  profile: UserProfile
  isLoading: boolean
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

const defaultProfile: UserProfile = {
  name: 'Student',
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const stored = await AsyncStorage.getItem(PROFILE_KEY)
      if (stored) {
        setProfile(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const newProfile = { ...profile, ...updates }
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile))
      setProfile(newProfile)
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  return (
    <ProfileContext.Provider value={{ profile, isLoading, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider')
  }
  return context
}
