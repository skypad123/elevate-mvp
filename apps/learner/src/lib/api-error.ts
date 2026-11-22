import { formatSgd, isUserErrorCode } from '@elevate/core'
import type { Translator } from '@elevate/i18n'
import { useCallback } from 'react'
import { usePreferences } from './preferences'

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

  /** A body that isn't the API's error envelope (a proxy's error page) gets `request_failed`. */
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
    const err = body?.error
    return new ApiError(res.status, err?.code ?? 'request_failed', err?.message ?? '', err?.details)
  }
}

type JsonOf<R> = R extends { json: () => Promise<infer J> } ? J : never

/** Throws ApiError for non-2xx; otherwise returns the success body with the error envelope excluded. */
export async function unwrap<
  R extends { ok: boolean; status: number; json: () => Promise<unknown> },
>(res: R): Promise<Exclude<JsonOf<R>, ErrorEnvelope>> {
  if (!res.ok) throw await ApiError.fromResponse(res)
  return (await res.json()) as Exclude<JsonOf<R>, ErrorEnvelope>
}

/**
 * fetch's own failure, by its message: React Native, then Chrome, Firefox and Safari. Any other
 * TypeError is a bug, not a lost connection, and gets the generic sentence.
 */
const NETWORK_FAILURES = [
  'Network request failed',
  'Failed to fetch',
  'NetworkError when attempting to fetch resource.',
  'Load failed',
]

function neverReached(error: unknown): boolean {
  return error instanceof Error && NETWORK_FAILURES.includes(error.message)
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v !== '') : []

/**
 * A failed request in the reader's language, from the API's error code (ADR 010). The API's own
 * English sentence is never shown: a code the app doesn't know gets the generic sentence.
 */
export function errorMessage(error: unknown, t: Translator): string {
  if (error instanceof ApiError) {
    if (!isUserErrorCode(error.code)) return t('learnerCommon.error.generic')
    const details = (error.details ?? {}) as Record<string, unknown>
    if (error.code === 'lesson_locked') {
      const titles = strings(details.blockedByTitles)
      return titles.length
        ? t('apiError.lesson_locked.after', {
            lessons: titles.join(t('learnerCommon.list.separator')),
          })
        : t('apiError.lesson_locked')
    }
    if (error.code === 'below_minimum') {
      const cents = typeof details.minimumCents === 'number' ? details.minimumCents : 100
      return t('apiError.below_minimum', { amount: formatSgd(cents) })
    }
    return t(`apiError.${error.code}`)
  }
  if (neverReached(error)) return t('learnerCommon.error.unreachable')
  return t('learnerCommon.error.generic')
}

/** `errorMessage` in the language on screen. Store the error, and word it when rendering. */
export function useErrorMessage(): (error: unknown) => string {
  const { t } = usePreferences()
  return useCallback((error: unknown) => errorMessage(error, t), [t])
}
