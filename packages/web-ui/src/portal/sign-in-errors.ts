import type { UserErrorCode } from '@elevate/core'
import type { MessageKey } from '@elevate/i18n'
import { useCallback } from 'react'
import { useErrorMessage } from '../preferences/errors'
import { useT } from '../preferences/PreferencesProvider'
import { ApiError } from './api'

/**
 * The error codes the sign-in requests answer (`auth.service.ts`, and the rate limit on asking
 * for a code). Each has a message `apiError.<code>`, shared with the learner app (ADR 010).
 */
const SIGN_IN_ERROR_CODES = [
  'link_invalid',
  'link_used',
  'link_expired',
  'code_invalid',
  'code_locked',
  'rate_limited',
] as const satisfies readonly UserErrorCode[]

type SignInErrorCode = (typeof SIGN_IN_ERROR_CODES)[number]

const isSignInErrorCode = (code: string): code is SignInErrorCode =>
  (SIGN_IN_ERROR_CODES as readonly string[]).includes(code)

/** The catalog message for a failed sign-in request whose code is known, else null. */
export function signInErrorKey(error: unknown): MessageKey | null {
  if (error instanceof ApiError && isSignInErrorCode(error.code)) return `apiError.${error.code}`
  return null
}

/**
 * A failed sign-in request in the chosen language: its code's message when the code is known,
 * otherwise `useErrorMessage()`, which shows the server's English sentence (such as Support
 * refusing an account that is not staff). Store the error, and word it when rendering.
 */
export function useSignInErrorMessage(): (error: unknown) => string {
  const t = useT()
  const errorMessage = useErrorMessage()
  return useCallback(
    (error: unknown) => {
      const key = signInErrorKey(error)
      return key ? t(key) : errorMessage(error)
    },
    [t, errorMessage],
  )
}
