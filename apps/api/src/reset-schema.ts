import { createDb } from '@elevate/db'
import { sql } from 'drizzle-orm'

/**
 * Empties the database: drops and recreates the `public` and `drizzle` schemas, so the next
 * migration run starts from nothing. Run as a one-off task from the API image
 * (`node dist/reset-schema.js`), followed by the migration task and `node dist/seed.js`.
 *
 * It refuses to run unless `ALLOW_SCHEMA_RESET=yes` is set for that one task. The variable is
 * never part of the service's configuration, so a normal deploy cannot reach this.
 */
if (process.env.ALLOW_SCHEMA_RESET !== 'yes') {
  console.error('refusing to reset the schema: set ALLOW_SCHEMA_RESET=yes for this one task')
  process.exit(1)
}
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

/** Host and database name only: the URL also holds the password. */
function describe(connectionString: string): string {
  try {
    const parsed = new URL(connectionString)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return 'the configured database'
  }
}

const { db, pool } = createDb(url)
try {
  await db.execute(sql`drop schema if exists public cascade`)
  await db.execute(sql`drop schema if exists drizzle cascade`)
  await db.execute(sql`create schema public`)
  await db.execute(sql`create schema drizzle`)
  console.log(`schema reset on ${describe(url)}; run the migration task next`)
} finally {
  await pool.end()
}
