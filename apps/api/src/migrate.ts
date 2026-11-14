import { createDb, migrationsFolder } from '@elevate/db'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

/**
 * Applies pending migrations and exits. Deployed environments run this as a one-off task from the
 * API image (`node dist/migrate.js`); local development keeps using `npm run db:migrate`.
 */
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const { db, pool } = createDb(url)
try {
  await migrate(db, { migrationsFolder })
  console.log(`migrations applied from ${migrationsFolder}`)
} finally {
  await pool.end()
}
