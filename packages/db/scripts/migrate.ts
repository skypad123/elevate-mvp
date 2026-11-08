import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from '../src/client'
import { migrationsFolder } from '../src/migrations-folder'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env)')

const { db, pool } = createDb(url)
await migrate(db, { migrationsFolder })
await pool.end()
console.log('migrations applied')
