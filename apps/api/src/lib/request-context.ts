import { AsyncLocalStorage } from 'node:async_hooks'

type RequestContext = { origin: string }

const storage = new AsyncLocalStorage<RequestContext>()

/** Runs `fn` with the current request's origin available to lower layers (e.g. URL builders). */
export function runWithRequest<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn)
}

export function currentRequestOrigin(): string | null {
  return storage.getStore()?.origin ?? null
}
