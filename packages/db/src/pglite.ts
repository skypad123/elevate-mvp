import { PGlite } from '@electric-sql/pglite'
import { citext } from '@electric-sql/pglite/contrib/citext'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { paramsInErrors } from './client'
import { learnerRelations } from './learner-relations'
import { migrationsFolder } from './migrations-folder'
import { relations } from './schema'

export type PgliteDb = PgliteDatabase<typeof relations>
/** The learner-facing client on PGlite; see `LearnerDb` in `./index`. */
export type PgliteLearnerDb = PgliteDatabase<typeof learnerRelations>

/**
 * In-memory Postgres for tests (and offline demos). Runs the same generated migrations as
 * production Postgres, with the extensions the schema needs preloaded. `learnerDb` is the
 * learner-facing client on the same database, as `createDb` returns it.
 * Note: PGlite only reads options from an options object, so dataDir is passed inside it.
 */
export async function createPgliteDb(
  dataDir?: string,
): Promise<{ db: PgliteDb; learnerDb: PgliteLearnerDb; client: PGlite }> {
  const client = new PGlite({ ...(dataDir ? { dataDir } : {}), extensions: { citext, pg_trgm } })
  const db = drizzle({ client, relations, paramsInErrors })
  const learnerDb = drizzle({ client, relations: learnerRelations, paramsInErrors })
  await migrate(db, { migrationsFolder })
  return { db, learnerDb, client }
}
