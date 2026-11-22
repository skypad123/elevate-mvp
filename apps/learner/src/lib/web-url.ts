import Constants from 'expo-constants'
import { Platform } from 'react-native'

/** The development host's name, from the Metro address the app was loaded from. */
const devHost = () => Constants.expoConfig?.hostUri?.split(':')[0]

/** The learner web app, for hand-offs from native (checkout happens on the web). */
export function webBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin
  const host = devHost()
  return host ? `http://${host}:8081` : 'http://localhost:8081'
}

/**
 * Elevate Teach, the teacher portal, for the `/teach` screen's link. A value that is missing or
 * points at this machine (`localhost`, `127.0.0.1`) means Teach's development port on the
 * development host, as Support's `teachUrl()` treats it, so the link also works from a phone.
 */
export function teachUrl(path = ''): string {
  const fromEnv = process.env.EXPO_PUBLIC_TEACH_URL?.replace(/\/$/, '')
  if (fromEnv && !/localhost|127\.0\.0\.1/.test(fromEnv)) return `${fromEnv}${path}`
  if (Platform.OS === 'web' && typeof window !== 'undefined')
    return `${window.location.protocol}//${window.location.hostname}:5173${path}`
  const host = devHost()
  return `http://${host ?? 'localhost'}:5173${path}`
}
