import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from '../src/client'
import { migrationsFolder } from '../src/migrations-folder'
import { applyApiRole } from '../src/roles'

// Migrations run as the owner: `MIGRATION_DATABASE_URL` when the API connects as its own user,
// else the one `DATABASE_URL`.
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env)')

const { db, pool } = createDb(url)
await migrate(db, { migrationsFolder })
console.log('migrations applied')

const user = process.env.API_DATABASE_USER
const password = process.env.API_DATABASE_PASSWORD
if (user && password) {
  await applyApiRole(pool, { user, password })
  console.log(`grants applied for the API database user ${user}`)
}
await pool.end()
