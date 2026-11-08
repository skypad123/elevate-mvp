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
    const err = body?.error
    return new ApiError(
      res.status,
      err?.code ?? 'request_failed',
      err?.message ?? 'Something went wrong',
      err?.details,
    )
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

export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Try again.',
): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message === 'Network request failed')
    return 'Cannot reach Elevate. Check your connection.'
  return fallback
}
