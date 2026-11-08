import { createApiClient } from '@elevate/api/client'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { tokenStorage } from './token-storage'

const API_PORT = 4400

/**
 * Where the API lives. EXPO_PUBLIC_API_URL wins; otherwise in dev we point at the same host that
 * serves Metro (so a phone on the LAN reaches the Mac without configuration).
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

function devHost(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.hostname
  return Constants.expoConfig?.hostUri?.split(':')[0] ?? null
}

/**
 * Where the API lives. EXPO_PUBLIC_API_URL wins, except that a localhost URL is rewritten to the
 * host serving this app (Metro on native, the page on web) so phones and other devices on the
 * LAN reach the Mac without configuration.
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')
  const host = devHost()
  if (fromEnv) {
    const match = fromEnv.match(/^(https?:\/\/)([^/:]+)(:\d+)?(\/.*)?$/)
    if (match && LOCAL_HOSTS.has(match[2] ?? '') && host && !LOCAL_HOSTS.has(host)) {
      return `${match[1]}${host}${match[3] ?? ''}${match[4] ?? ''}`
    }
    return fromEnv
  }
  return host ? `http://${host}:${API_PORT}` : `http://localhost:${API_PORT}`
}

export const apiClient = createApiClient(apiBaseUrl(), () => tokenStorage.get())

/** Typed RPC root: `api.auth['magic-link'].$post(...)`. */
export const api = apiClient.api
