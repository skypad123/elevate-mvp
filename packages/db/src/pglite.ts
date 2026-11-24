import { PGlite } from '@electric-sql/pglite'
import { citext } from '@electric-sql/pglite/contrib/citext'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { paramsInErrors } from './client'
import { learnerRelations } from './learner-relations'
import { migrationsFolder } from './migrations-folder'
import { apiRoleGrantStatements, assertRoleName } from './roles'
import { relations } from './schema'

export type PgliteDb = PgliteDatabase<typeof relations>
/** The learner-facing client on PGlite; see `LearnerDb` in `./index`. */
export type PgliteLearnerDb = PgliteDatabase<typeof learnerRelations>

/**
 * In-memory Postgres for tests (and offline demos). Runs the same generated migrations as
 * production Postgres, with the extensions the schema needs preloaded. `learnerDb` is the
 * learner-facing client on the same database, as `createDb` returns it.
 * Note: PGlite only reads options from an options object, so dataDir is passed inside it.
 *
 * With `apiRole`, after migrating it creates that role (without login) if it is missing, gives it
 * the API database user's grants (`apiRoleGrantStatements`) and switches the connection to it, so
 * everything after runs with what the deployed API may do.
 */
export async function createPgliteDb(
  options: { dataDir?: string; apiRole?: string } = {},
): Promise<{ db: PgliteDb; learnerDb: PgliteLearnerDb; client: PGlite }> {
  const { dataDir, apiRole } = options
  if (apiRole !== undefined) assertRoleName(apiRole)
  const client = new PGlite({ ...(dataDir ? { dataDir } : {}), extensions: { citext, pg_trgm } })
  const db = drizzle({ client, relations, paramsInErrors })
  const learnerDb = drizzle({ client, relations: learnerRelations, paramsInErrors })
  await migrate(db, { migrationsFolder })
  if (apiRole !== undefined) {
    await client.exec(
      [
        `do $$ begin if not exists (select from pg_roles where rolname = '${apiRole}') then create role ${apiRole} nologin; end if; end $$;`,
        ...apiRoleGrantStatements(apiRole),
        `set role ${apiRole};`,
      ].join('\n'),
    )
  }
  return { db, learnerDb, client }
}
