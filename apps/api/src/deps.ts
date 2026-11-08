import { type AnyDb, createDb } from '@elevate/db'
import type { Env } from './env'
import { createLogger, type Logger } from './lib/logger'
import { createMailer, type Mailer } from './providers/mailer'
import { createStorage, type StorageProvider } from './providers/storage'

export type Deps = {
  env: Env
  db: AnyDb
  mailer: Mailer
  storage: StorageProvider
  log: Logger
  now: () => Date
}

export async function createDeps(env: Env): Promise<Deps & { close: () => Promise<void> }> {
  const log = createLogger(env.LOG_LEVEL ?? (env.isTest ? 'silent' : 'info'), env.isProd)
  const { db, pool } = createDb(env.DATABASE_URL)
  const mailer = createMailer(env, log)
  const storage = createStorage(env)
  return {
    env,
    db,
    mailer,
    storage,
    log,
    now: () => new Date(),
    close: async () => {
      await pool.end()
    },
  }
}
