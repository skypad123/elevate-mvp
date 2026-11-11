import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { relations } from './schema'

export type Db = NodePgDatabase<typeof relations>

/**
 * Drizzle leaves query values out of its error messages unless asked. They help when debugging,
 * but they include emails and token hashes, so production logs go without them.
 */
export const paramsInErrors = process.env.NODE_ENV !== 'production'

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 })
}

export function createDb(connectionString: string): { db: Db; pool: pg.Pool } {
  const pool = createPool(connectionString)
  const db = drizzle({ client: pool, relations, paramsInErrors })
  return { db, pool }
}
