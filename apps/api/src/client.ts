import { hc } from 'hono/client'
import type { AppType } from './app'

// This module is imported by the frontends; keep it free of Node-only code.
const typedClient = hc<AppType>('')
export type ApiClient = typeof typedClient

export type TokenGetter = () => Promise<string | null> | string | null

export function createApiClient(
  baseUrl: string,
  getToken: TokenGetter = () => null,
  fetchImpl: typeof fetch = fetch,
): ApiClient {
  return hc<AppType>(baseUrl, {
    fetch: fetchImpl,
    headers: async () => {
      const headers: Record<string, string> = {}
      const token = await getToken()
      if (token) headers.Authorization = `Bearer ${token}`
      return headers
    },
  })
}
