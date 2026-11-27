import { createDb } from '@elevate/db'

/**
 * Confirms the database refuses the API's user an update of an attendance row (ADR 012). The
 * deploy workflow runs it as a one-off task from the API's task definition, so it connects as the
 * running API does, with `DATABASE_URL`; it never reads `MIGRATION_DATABASE_URL`.
 *
 * The update matches no row, so it changes nothing even where it is allowed. Exit 0: refused
 * with `42501` (insufficient privilege), as intended. Exit 1: the update was allowed. Exit 2:
 * any other error.
 */
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(2)
}

const { pool } = createDb(url)
let code = 2
try {
  await pool.query('update attendance_events set request_id = request_id where false')
  console.error('the API database user may update attendance_events: it must not')
  code = 1
} catch (error) {
  const pgCode = (error as { code?: unknown }).code
  if (pgCode === '42501') {
    console.log('update of attendance_events refused, as intended')
    code = 0
  } else {
    console.error('the check failed', {
      code: pgCode,
      error: error instanceof Error ? error.message : String(error),
    })
  }
} finally {
  await pool.end()
}
process.exit(code)
