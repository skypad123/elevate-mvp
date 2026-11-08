const KEY = 'elevate.session.token'
let cached: string | null | undefined

/** Web: expo-secure-store has no web implementation, so the token lives in localStorage. */
export const tokenStorage = {
  async get(): Promise<string | null> {
    if (cached !== undefined) return cached
    try {
      cached = window.localStorage.getItem(KEY)
    } catch {
      cached = null
    }
    return cached
  },
  async set(token: string): Promise<void> {
    cached = token
    try {
      window.localStorage.setItem(KEY, token)
    } catch {
      // private mode: keep the in-memory copy for this tab
    }
  },
  async clear(): Promise<void> {
    cached = null
    try {
      window.localStorage.removeItem(KEY)
    } catch {
      // ignore
    }
  },
}
