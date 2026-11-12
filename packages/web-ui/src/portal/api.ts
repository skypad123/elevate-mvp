import { createApiClient } from '@elevate/api/client'

export type ErrorEnvelope = {
  error: { code: string; message: string; details?: unknown; requestId?: string }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
  static async fromResponse(res: {
    status: number
    json: () => Promise<unknown>
  }): Promise<ApiError> {
    let body: Partial<ErrorEnvelope> | null = null
    try {
      body = (await res.json()) as ErrorEnvelope
    } catch {
      body = null
    }
    return new ApiError(
      res.status,
      body?.error?.code ?? 'request_failed',
      body?.error?.message ?? 'Something went wrong',
      body?.error?.details,
    )
  }
}

type JsonOf<R> = R extends { json: () => Promise<infer J> } ? J : never

export async function unwrap<
  R extends { ok: boolean; status: number; json: () => Promise<unknown> },
>(res: R): Promise<Exclude<JsonOf<R>, ErrorEnvelope>> {
  if (!res.ok) throw await ApiError.fromResponse(res)
  return (await res.json()) as Exclude<JsonOf<R>, ErrorEnvelope>
}

/**
 * What to tell the reader about a failed request: the server's own message when it sent one,
 * else one of two sentences worded here. A translated page uses `useErrorMessage()` from
 * `@elevate/web-ui/preferences`, which passes those two sentences in the chosen language.
 */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Try again.',
  unreachable = 'Cannot reach the Elevate API. Is it running?',
): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return unreachable
  return fallback
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {}
  const out: Record<string, string> = {}
  for (const d of error.details as Array<{ path?: string; message?: string }>) {
    if (d.path && d.message && !out[d.path]) out[d.path] = d.message
  }
  return out
}

export function createTokenStore(key: string) {
  let cached: string | null | undefined
  return {
    get(): string | null {
      if (cached !== undefined) return cached
      try {
        cached = window.localStorage.getItem(key)
      } catch {
        cached = null
      }
      return cached
    },
    set(token: string) {
      cached = token
      try {
        window.localStorage.setItem(key, token)
      } catch {
        // private mode
      }
    },
    clear() {
      cached = null
      try {
        window.localStorage.removeItem(key)
      } catch {
        // ignore
      }
    },
  }
}

export type TokenStore = ReturnType<typeof createTokenStore>

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Where the API lives. A VITE_API_URL pointing at localhost is treated as "the machine serving
 * this page", so opening the portal from another device on the LAN still reaches the API.
 */
export function apiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  const pageHost = window.location.hostname
  if (fromEnv) {
    try {
      const url = new URL(fromEnv)
      if (LOCAL_HOSTS.has(url.hostname) && !LOCAL_HOSTS.has(pageHost)) url.hostname = pageHost
      return url.toString().replace(/\/$/, '')
    } catch {
      return fromEnv
    }
  }
  return `${window.location.protocol}//${pageHost}:4400`
}

export function createPortalApi(tokenKey: string) {
  const tokenStore = createTokenStore(tokenKey)
  const client = createApiClient(apiBaseUrl(), () => tokenStore.get())
  return { api: client.api, client, tokenStore }
}

export type PortalApi = ReturnType<typeof createPortalApi>['api']
