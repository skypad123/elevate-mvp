import { type AnyDb, createDb } from '@elevate/db'
import type { Env } from './env'
import { createLogger, type Logger } from './lib/logger'
import { createMailer, type Mailer } from './providers/mailer'
import { createPaymentsProvider, type PaymentsProvider } from './providers/payments'
import { createStorage, type StorageProvider } from './providers/storage'
import { createVideoProvider, type VideoProvider } from './providers/video'

export type Deps = {
  env: Env
  db: AnyDb
  mailer: Mailer
  storage: StorageProvider
  video: VideoProvider
  payments: PaymentsProvider
  log: Logger
  now: () => Date
}

export async function createDeps(env: Env): Promise<Deps & { close: () => Promise<void> }> {
  const log = createLogger(env.LOG_LEVEL ?? (env.isTest ? 'silent' : 'info'), env.isProd)
  const { db, pool } = createDb(env.DATABASE_URL)
  const mailer = createMailer(env, log)
  const storage = createStorage(env)
  const video = createVideoProvider(env, storage)
  const payments = createPaymentsProvider(env)
  if (payments.driver === 'unconfigured')
    log.warn('STRIPE_SECRET_KEY not set: payments endpoints will respond 503')
  return {
    env,
    db,
    mailer,
    storage,
    video,
    payments,
    log,
    now: () => new Date(),
    close: async () => {
      await pool.end()
    },
  }
}
