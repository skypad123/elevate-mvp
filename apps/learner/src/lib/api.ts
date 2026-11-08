import { createApiClient } from '@elevate/api/client'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { tokenStorage } from './token-storage'

const API_PORT = 4400

/**
 * Where the API lives. EXPO_PUBLIC_API_URL wins; otherwise in dev we point at the same host that
 * serves Metro (so a phone on the LAN reaches the Mac without configuration).
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0]
  return host ? `http://${host}:${API_PORT}` : `http://localhost:${API_PORT}`
}

export const apiClient = createApiClient(apiBaseUrl(), () => tokenStorage.get())

/** Typed RPC root: `api.auth['magic-link'].$post(...)`. */
export const api = apiClient.api
