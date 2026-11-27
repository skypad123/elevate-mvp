import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPgliteDb } from '../src/pglite'
import { apiRoleGrantStatements } from '../src/roles'

// What the API's database user may do, checked against the in-memory database running as that
// role. `42501` is Postgres's "insufficient privilege".

let client: PGlite
let eventId: string
let enrollmentId: string

const ids = {
  user: '00000000-0000-4000-8000-000000000001',
  profile: '00000000-0000-4000-8000-000000000002',
  course: '00000000-0000-4000-8000-000000000003',
  class: '00000000-0000-4000-8000-000000000004',
  block: '00000000-0000-4000-8000-000000000005',
}

async function refused(statement: string, params: unknown[] = []): Promise<void> {
  await expect(client.query(statement, params)).rejects.toMatchObject({ code: '42501' })
}

async function insertEvent(): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into attendance_events
       (class_id, block_id, enrollment_id, learner_user_id, type, actor_user_id, actor_role,
        request_id, created_at)
     values ($1, $2, $3, $4, 'attempt_refused', $4, 'learner', 'req-1', now())
     returning id`,
    [ids.class, ids.block, enrollmentId, ids.user],
  )
  return (rows[0] as { id: string }).id
}

beforeAll(async () => {
  ;({ client } = await createPgliteDb({ apiRole: 'elevate_api' }))
  // Everything below runs as `elevate_api`, which may insert into these tables.
  await client.query(`insert into users (id, email) values ($1, 'learner@example.com')`, [ids.user])
  await client.query(
    `insert into profiles (id, type, owner_user_id, display_name) values ($1, 'personal', $2, 'P')`,
    [ids.profile, ids.user],
  )
  await client.query(
    `insert into courses (id, profile_id, title, slug, category) values ($1, $2, 'C', 'c', 'x')`,
    [ids.course, ids.profile],
  )
  await client.query(
    `insert into classes (id, profile_id, course_id, name, delivery, instructor_user_id, seats)
     values ($1, $2, $3, 'Class', 'remote', $4, 10)`,
    [ids.class, ids.profile, ids.course, ids.user],
  )
  await client.query(
    `insert into class_blocks (id, class_id, position, starts_at, ends_at, code_secret)
     values ($1, $2, 0, now(), now() + interval '1 hour', 'secret')`,
    [ids.block, ids.class],
  )
  const { rows } = await client.query<{ id: string }>(
    `insert into enrollments (user_id, course_id, class_id, status) values ($1, $2, $3, 'active')
     returning id`,
    [ids.user, ids.course, ids.class],
  )
  enrollmentId = (rows[0] as { id: string }).id
  eventId = await insertEvent()
})

afterAll(async () => {
  await client?.close()
})

describe('the API database role', () => {
  it('runs as the restricted role', async () => {
    const { rows } = await client.query<{ current_user: string }>('select current_user')
    expect(rows[0]?.current_user).toBe('elevate_api')
  })

  it('may insert and select attendance events', async () => {
    const second = await insertEvent()
    const { rows } = await client.query('select id from attendance_events where id = any($1)', [
      [eventId, second],
    ])
    expect(rows).toHaveLength(2)
  })

  it('may not update, delete or truncate attendance events', async () => {
    await refused(`update attendance_events set reason = 'changed' where id = $1`, [eventId])
    await refused('delete from attendance_events where id = $1', [eventId])
    await refused('truncate attendance_events cascade')
  })

  it('may insert, select and delete a location, but not update it', async () => {
    await client.query(
      'insert into attendance_event_locations (event_id, lat, lng) values ($1, 1.3, 103.8)',
      [eventId],
    )
    const { rows } = await client.query(
      'select lat, lng from attendance_event_locations where event_id = $1',
      [eventId],
    )
    expect(rows).toEqual([{ lat: 1.3, lng: 103.8 }])
    await refused('update attendance_event_locations set lat = 0 where event_id = $1', [eventId])
    const deleted = await client.query(
      'delete from attendance_event_locations where event_id = $1',
      [eventId],
    )
    expect(deleted.affectedRows).toBe(1)
  })

  it('may update other tables', async () => {
    const updated = await client.query(
      `update enrollments set status = 'cancelled' where id = $1`,
      [enrollmentId],
    )
    expect(updated.affectedRows).toBe(1)
  })

  it('may read the migration journal', async () => {
    const { rows } = await client.query('select id from drizzle.__drizzle_migrations')
    expect(rows.length).toBeGreaterThan(0)
  })

  it('may not create a table', async () => {
    await refused('create table public.not_allowed (id integer)')
  })
})

describe('role names', () => {
  it('refuses a name with an upper-case letter or a space before any SQL runs', async () => {
    expect(() => apiRoleGrantStatements('Elevate_api')).toThrow(/invalid database role name/)
    expect(() => apiRoleGrantStatements('elevate api')).toThrow(/invalid database role name/)
    await expect(createPgliteDb({ apiRole: 'Elevate' })).rejects.toThrow(
      /invalid database role name/,
    )
  })
})
