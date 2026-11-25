import { applyApiRole, createDb, migrationsFolder } from '@elevate/db'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

/**
 * Applies pending migrations and exits. Deployed environments run this as a one-off task from the
 * migration task definition (`node dist/migrate.js`); local development keeps using
 * `npm run db:migrate`.
 *
 * Migrations need the database owner: `MIGRATION_DATABASE_URL` when the API connects as its own
 * restricted user, else the one `DATABASE_URL`. With `API_DATABASE_USER` and
 * `API_DATABASE_PASSWORD` both set, it then creates or updates that user and its grants
 * (`applyApiRole`, ADR 012).
 */
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const { db, pool } = createDb(url)
try {
  await migrate(db, { migrationsFolder })
  console.log(`migrations applied from ${migrationsFolder}`)
  const user = process.env.API_DATABASE_USER
  const password = process.env.API_DATABASE_PASSWORD
  if (user && password) {
    await applyApiRole(pool, { user, password })
    // The password is never logged.
    console.log(`grants applied for the API database user ${user}`)
  }
} finally {
  await pool.end()
}
