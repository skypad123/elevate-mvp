import { type AnyDb, migrationsFolder, pendingMigrations } from '@elevate/db'
import type { Logger } from './logger'

/**
 * Logs a warning when the database has not applied every migration this build ships, so queries
 * on the new columns fail (a sign-in 500s on a missing `users.locale`, for example). It never
 * stops the server: a failed check is logged too.
 */
export async function warnOnPendingMigrations(
  db: AnyDb,
  log: Logger,
  folder: string = migrationsFolder,
): Promise<void> {
  try {
    const pending = await pendingMigrations(db, folder)
    if (pending.length === 0) return
    log.warn(
      `database is missing ${pending.length} migration(s); queries that need them will fail. ` +
        'Run `npm run db:migrate` (deployed: the migrate task)',
      { pending },
    )
  } catch (error) {
    log.warn('could not check for pending migrations', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
