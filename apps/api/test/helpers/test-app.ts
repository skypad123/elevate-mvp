import { schema as s } from '@elevate/db'
import { createPgliteDb } from '@elevate/db/pglite'
import { createApp } from '../../src/app'
import type { Deps } from '../../src/deps'
import { loadEnv } from '../../src/env'
import { silentLogger } from '../../src/lib/logger'
import { FakeMailer } from '../../src/providers/mailer'
import { FakePaymentsProvider } from '../../src/providers/payments'
import { FakeStorage } from '../../src/providers/storage'
import { FakeVideoProvider } from '../../src/providers/video'

export type ApiResponse<T = unknown> = { status: number; body: T; res: Response }

export async function createTestApp(overrides: Record<string, string> = {}) {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'pglite://memory',
    SESSION_SECRET: 'test-secret-test-secret-test-secret',
    DEV_ENDPOINTS_ENABLED: 'true',
    API_URL: 'http://api.test',
    LEARNER_URL: 'http://learner.test',
    TEACH_URL: 'http://teach.test',
    SUPPORT_URL: 'http://support.test',
    ...overrides,
  })
  const { db, client } = await createPgliteDb()
  const mailer = new FakeMailer()
  const storage = new FakeStorage(env.API_URL)
  const video = new FakeVideoProvider()
  const payments = new FakePaymentsProvider()
  let clock = new Date('2026-11-08T04:00:00.000Z')
  const deps: Deps = {
    env,
    db,
    mailer,
    storage,
    video,
    payments,
    log: silentLogger,
    now: () => clock,
  }
  const app = createApp(deps)

  // biome-ignore lint/suspicious/noExplicitAny: test helper returns loosely typed JSON on purpose
  async function api<T = any>(
    method: string,
    path: string,
    options: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { ...options.headers }
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    if (options.token) headers.authorization = `Bearer ${options.token}`
    const res = await app.request(path, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
    const text = await res.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { status: res.status, body: body as T, res }
  }

  async function signIn(email: string, audience: 'learner' | 'teach' | 'support' = 'learner') {
    const requested = await api('POST', '/api/auth/magic-link', { body: { email, audience } })
    if (requested.status !== 200)
      throw new Error(`magic link request failed: ${JSON.stringify(requested.body)}`)
    const code = requested.body.dev.code as string
    const verified = await api('POST', '/api/auth/verify', { body: { email, code } })
    return {
      status: verified.status,
      body: verified.body,
      token: verified.body?.token as string | undefined,
    }
  }

  async function ensureUser(email: string, name?: string) {
    const existing = await db.query.users.findFirst({ where: { email } })
    if (existing) return existing
    const [created] = await db
      .insert(s.users)
      .values({ email, name: name ?? null })
      .returning()
    if (!created) throw new Error('failed to create user')
    return created
  }

  async function grantRole(email: string, role: 'teacher' | 'support_agent' | 'super_admin') {
    const user = await ensureUser(email)
    await db.insert(s.userRoles).values({ userId: user.id, role }).onConflictDoNothing()
    return user
  }

  return {
    app,
    db,
    client,
    mailer,
    storage,
    video,
    payments,
    deps,
    api,
    signIn,
    ensureUser,
    grantRole,
    setClock: (date: Date) => {
      clock = date
    },
    advanceClock: (ms: number) => {
      clock = new Date(clock.getTime() + ms)
    },
    close: () => client.close(),
  }
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>
