import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

export type Schema = typeof schema
export type Db = NodePgDatabase<Schema>

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 })
}

export function createDb(connectionString: string): { db: Db; pool: pg.Pool } {
  const pool = createPool(connectionString)
  const db = drizzle({ client: pool, schema, casing: 'snake_case' })
  return { db, pool }
}
