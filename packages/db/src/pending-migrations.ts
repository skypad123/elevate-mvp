import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import type { Db } from './client'
import { migrationsFolder as defaultFolder } from './migrations-folder'
import type { PgliteDb } from './pglite'

/**
 * Names of the migrations in `folder` that the database has not applied, oldest first. Mirrors
 * Drizzle's migrator: a migration is a folder holding `migration.sql`, and it counts as applied
 * when its folder name is in `drizzle.__drizzle_migrations`. A database never migrated has
 * every migration pending.
 */
export async function pendingMigrations(
  db: Db | PgliteDb,
  folder: string = defaultFolder,
): Promise<string[]> {
  const local = readdirSync(folder)
    .filter((name) => existsSync(join(folder, name, 'migration.sql')))
    .sort((a, b) => a.localeCompare(b))

  const [table] = await db.execute<{ present: boolean }>(
    sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`,
    'objects',
  )
  if (!table?.present) return local

  const applied = await db.execute<{ name: string | null }>(
    sql`select name from drizzle.__drizzle_migrations`,
    'objects',
  )
  const names = new Set(applied.map((row) => row.name))
  return local.filter((name) => !names.has(name))
}
