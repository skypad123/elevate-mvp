import * as SecureStore from 'expo-secure-store'

const KEY = 'elevate.session.token'
let cached: string | null | undefined

/** Native: session token lives in the device keychain / keystore. */
export const tokenStorage = {
  async get(): Promise<string | null> {
    if (cached !== undefined) return cached
    cached = (await SecureStore.getItemAsync(KEY)) ?? null
    return cached
  },
  async set(token: string): Promise<void> {
    cached = token
    await SecureStore.setItemAsync(KEY, token)
  },
  async clear(): Promise<void> {
    cached = null
    await SecureStore.deleteItemAsync(KEY)
  },
}
