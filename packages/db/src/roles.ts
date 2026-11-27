import type pg from 'pg'

/**
 * What the API's database user may do (docs/designs/scheduled-classes-attendance.md, "The API's
 * database user"). The migration task applies this as the owner; the test database applies the
 * same statements, so a missing grant fails the tests.
 *
 * The user can read and write every table except that it can never change or remove an attendance
 * row, and can erase a reading's coordinates but not alter them.
 *
 * Only `attendance_events` and `attendance_event_locations` are restricted. Every other table is
 * an ordinary table for this user, covered by the default privileges below: so the class-sales
 * tables (`seat_refunds`, `class_cancellations`, `payout_runs`, `payouts`, `payout_adjustments`)
 * and a view the migrations recreate, such as `self_paced_enrollments`, need no grant here.
 */

const ROLE_NAME = /^[a-z_][a-z0-9_]*$/

/**
 * Role names go into SQL as bare identifiers, because Postgres takes no bound values in these
 * statements, so anything but a plain lower-case name is refused before any SQL runs.
 */
export function assertRoleName(role: string): void {
  if (!ROLE_NAME.test(role)) throw new Error(`invalid database role name: ${JSON.stringify(role)}`)
}

/** The grants for `role`, in the order they must run. The role must already exist. */
export function apiRoleGrantStatements(role: string): string[] {
  assertRoleName(role)
  return [
    `do $$ begin execute format('grant connect on database %I to ${role}', current_database()); end $$;`,
    `grant usage on schema public, drizzle to ${role};`,
    `grant select on all tables in schema drizzle to ${role};`,
    `grant select, insert, update, delete on all tables in schema public to ${role};`,
    `grant usage on all sequences in schema public to ${role};`,
    `revoke update, delete, truncate on attendance_events from ${role};`,
    `revoke update, truncate on attendance_event_locations from ${role};`,
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${role};`,
    `alter default privileges in schema public grant usage on sequences to ${role};`,
  ]
}

/**
 * Creates the API's login user, or resets its password and attributes, and applies the grants,
 * all in one transaction on one connection: the user never holds update or delete on
 * `attendance_events`, even for a moment. Run as the owner, after migrations.
 *
 * The password is quoted with the client's `escapeLiteral`. No statement here is logged.
 */
export async function applyApiRole(
  pool: pg.Pool,
  { user, password }: { user: string; password: string },
): Promise<void> {
  assertRoleName(user)
  if (!password) throw new Error('the API database password is empty')
  const client = await pool.connect()
  try {
    await client.query('begin')
    // The lookup runs as its own statement rather than inside a `do` block, so the password
    // literal is never placed inside a dollar-quoted body, where a `$$` in it would end the body.
    const existing = await client.query('select 1 from pg_roles where rolname = $1', [user])
    const verb = existing.rowCount ? 'alter' : 'create'
    await client.query(
      `${verb} role ${user} login nosuperuser nocreatedb nocreaterole password ${client.escapeLiteral(password)}`,
    )
    for (const statement of apiRoleGrantStatements(user)) await client.query(statement)
    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
