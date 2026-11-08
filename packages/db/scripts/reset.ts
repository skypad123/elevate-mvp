import { sql } from 'drizzle-orm'
import { createDb } from '../src/client'

if (process.env.NODE_ENV === 'production')
  throw new Error('refusing to reset a production database')
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const { db, pool } = createDb(url)
await db.execute(sql`drop schema if exists public cascade`)
await db.execute(sql`drop schema if exists drizzle cascade`)
await db.execute(sql`create schema public`)
await pool.end()
console.log('database reset; now run: npm run db:migrate && npm run db:seed')
