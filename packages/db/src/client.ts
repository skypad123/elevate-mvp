import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { learnerRelations } from './learner-relations'
import { relations } from './schema'

export type Db = NodePgDatabase<typeof relations>
/** The learner-facing client on node-postgres; see `LearnerDb` in `./index`. */
export type NodeLearnerDb = NodePgDatabase<typeof learnerRelations>

/**
 * Drizzle leaves query values out of its error messages unless asked. They help when debugging,
 * but they include emails and token hashes, so production logs go without them.
 */
export const paramsInErrors = process.env.NODE_ENV !== 'production'

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 })
}

/**
 * `db` is the full client. `learnerDb` shares its pool but knows course content only through the
 * live views, so learner-facing services cannot read a writer's draft rows through it.
 */
export function createDb(connectionString: string): {
  db: Db
  learnerDb: NodeLearnerDb
  pool: pg.Pool
} {
  const pool = createPool(connectionString)
  const db = drizzle({ client: pool, relations, paramsInErrors })
  const learnerDb = drizzle({ client: pool, relations: learnerRelations, paramsInErrors })
  return { db, learnerDb, pool }
}
