import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { PaymentsNotConfiguredError } from '../providers/payments/types'
import type { Logger } from './logger'

export class HttpError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const errors = {
  badRequest: (code: string, message: string, details?: unknown) =>
    new HttpError(400, code, message, details),
  unauthorized: (message = 'Sign in to continue') => new HttpError(401, 'unauthorized', message),
  invalidSession: () =>
    new HttpError(401, 'invalid_session', 'Your session has expired. Sign in again.'),
  forbidden: (message = 'You do not have access to this') =>
    new HttpError(403, 'forbidden', message),
  notFound: (what = 'Resource') => new HttpError(404, 'not_found', `${what} not found`),
  conflict: (code: string, message: string) => new HttpError(409, code, message),
  tooMany: (message = 'Too many attempts. Try again in a few minutes.') =>
    new HttpError(429, 'rate_limited', message),
  unprocessable: (code: string, message: string, details?: unknown) =>
    new HttpError(422, code, message, details),
}

export type ErrorBody = {
  error: { code: string; message: string; details?: unknown; requestId?: string }
}

export function createErrorHandler(log: Logger) {
  return (err: Error, c: Context) => {
    const requestId = c.get('requestId' as never) as string | undefined
    if (err instanceof PaymentsNotConfiguredError) {
      return c.json(
        {
          error: { code: 'payments_not_configured', message: err.message, requestId },
        } satisfies ErrorBody,
        503,
      )
    }
    if (err instanceof HttpError) {
      const body: ErrorBody = { error: { code: err.code, message: err.message, requestId } }
      if (err.details !== undefined) body.error.details = err.details
      return c.json(body, err.status)
    }
    log.error('unhandled error', {
      requestId,
      path: c.req.path,
      error: err.message,
      stack: err.stack,
    })
    return c.json(
      {
        error: { code: 'internal', message: 'Something went wrong on our side', requestId },
      } satisfies ErrorBody,
      500,
    )
  }
}
