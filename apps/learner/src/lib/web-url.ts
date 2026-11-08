import Constants from 'expo-constants'
import { Platform } from 'react-native'

/** The learner web app, for hand-offs from native (checkout happens on the web). */
export function webBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin
  const host = Constants.expoConfig?.hostUri?.split(':')[0]
  return host ? `http://${host}:8081` : 'http://localhost:8081'
}
