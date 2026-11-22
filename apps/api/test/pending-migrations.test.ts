import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { migrationsFolder, pendingMigrations, relations } from '@elevate/db'
import { createPgliteDb } from '@elevate/db/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { afterAll, describe, expect, it } from 'vitest'
import type { Logger } from '../src/lib/logger'
import { warnOnPendingMigrations } from '../src/lib/migration-check'

const shipped = readdirSync(migrationsFolder).sort()

function captureLog() {
  const warnings: { msg: string; data?: Record<string, unknown> }[] = []
  const log: Logger = {
    debug: () => {},
    info: () => {},
    warn: (msg, data) => warnings.push({ msg, data }),
    error: () => {},
  }
  return { log, warnings }
}

/** A migrations folder with the shipped migrations and one more (only folder names matter). */
const ahead = mkdtempSync(join(tmpdir(), 'elevate-migrations-'))
for (const name of [...shipped, '29990101000000_future']) {
  mkdirSync(join(ahead, name))
  writeFileSync(join(ahead, name, 'migration.sql'), '')
}
afterAll(() => rmSync(ahead, { recursive: true, force: true }))

describe('pending migrations', () => {
  it('finds none on a migrated database, and the API logs nothing', async () => {
    const { db, client } = await createPgliteDb()
    expect(await pendingMigrations(db)).toEqual([])
    const { log, warnings } = captureLog()
    await warnOnPendingMigrations(db, log)
    expect(warnings).toEqual([])
    await client.close()
  })

  it('names a migration the database has not applied, and the API warns', async () => {
    const { db, client } = await createPgliteDb()
    expect(await pendingMigrations(db, ahead)).toEqual(['29990101000000_future'])
    const { log, warnings } = captureLog()
    await warnOnPendingMigrations(db, log, ahead)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.msg).toContain('npm run db:migrate')
    expect(warnings[0]?.data).toEqual({ pending: ['29990101000000_future'] })
    await client.close()
  })

  it('counts every migration as pending on a database never migrated', async () => {
    const client = new PGlite()
    const db = drizzle({ client, relations })
    expect(await pendingMigrations(db)).toEqual(shipped)
    await client.close()
  })

  it('logs a failed check instead of throwing', async () => {
    const { db, client } = await createPgliteDb()
    await client.close()
    const { log, warnings } = captureLog()
    await warnOnPendingMigrations(db, log)
    expect(warnings.map((w) => w.msg)).toEqual(['could not check for pending migrations'])
  })
})
