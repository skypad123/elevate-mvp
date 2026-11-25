import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Support's read-only view of a class (docs/designs/scheduled-classes-attendance.md, "Support:
 * one class" and CUJ 11): the search, one class, one block with coordinates, and no write route.
 */
let t: TestApp
let agent: string
let classId: string
let blockId: string
let profileId: string
const enrollments: Record<string, string> = {}

beforeAll(async () => {
  t = await createTestApp()
  profileId = (await t.createProfile('owner@example.com', { displayName: 'Clay Corner' })).profile
    .id
  const courseId = (await t.createCourse(profileId, { status: 'live' })).courseId
  ;({ classId, blockId } = await t.createClass(profileId, courseId, {
    name: 'Weekend wheel class',
  }))
  await t.createClass(profileId, courseId, { name: 'Evening glaze class' })
  await t.grantRole('agent@example.com', 'support_agent')
  agent = (await t.signIn('agent@example.com', 'support')).token as string

  // one learner with a reading, one who refused location, one marked by hand, one locked out
  const checkIn = async (email: string, location: unknown, code?: string) => {
    const token = (await t.signIn(email)).token
    return t.api('POST', `/api/me/classes/blocks/${blockId}/check-in`, {
      token,
      body: {
        code: code ?? (await t.validCodeFor(blockId)),
        method: 'typed_code',
        platform: 'web',
        location,
      },
    })
  }
  for (const name of ['reader', 'refuser', 'marked', 'wrong']) {
    enrollments[name] = (await t.enrolInClass(`${name}@example.com`, classId)).id
  }
  expect(
    (await checkIn('reader@example.com', { lat: 1.2901, lng: 103.8502, accuracyM: 9 })).status,
  ).toBe(200)
  expect((await checkIn('refuser@example.com', { status: 'denied' })).status).toBe(200)
  for (let i = 0; i < 2; i++) {
    await checkIn('wrong@example.com', { lat: 1.3, lng: 103.9, accuracyM: 40 }, 'WRONG2')
  }
  const owner = (await t.signIn('owner@example.com', 'teach')).token
  const marked = await t.api(
    'POST',
    `/api/teach/profiles/${profileId}/classes/${classId}/blocks/${blockId}/learners/${enrollments.marked}/manual-mark`,
    { token: owner, body: { reasonCode: 'no_network', idDocumentType: 'passport' } },
  )
  expect(marked.status).toBe(200)
})
afterAll(async () => {
  await t.close()
})

const ids = (body: { items: { id: string }[] }) => body.items.map((i) => i.id)

describe('the search', () => {
  it('finds a class by its name, its profile’s name or a learner’s address', async () => {
    const byName = await t.api('GET', '/api/support/classes?q=weekend', { token: agent })
    expect(byName.status).toBe(200)
    expect(ids(byName.body)).toEqual([classId])
    expect(byName.body.items[0]).toMatchObject({
      name: 'Weekend wheel class',
      profile: { id: profileId, displayName: 'Clay Corner' },
      enrolledCount: 4,
    })
    const byProfile = await t.api('GET', '/api/support/classes?q=clay%20corner', { token: agent })
    expect(byProfile.body.items).toHaveLength(2)
    const byLearner = await t.api('GET', '/api/support/classes?q=refuser@example', {
      token: agent,
    })
    expect(ids(byLearner.body)).toEqual([classId])
    expect(
      (await t.api('GET', '/api/support/classes?q=nothing-like-this', { token: agent })).body,
    ).toEqual({ items: [] })
  })

  it('keeps to its limits', async () => {
    const one = await t.api('GET', '/api/support/classes?q=class&limit=1', { token: agent })
    expect(one.body.items).toHaveLength(1)
    expect(
      (await t.api('GET', '/api/support/classes?q=class&limit=51', { token: agent })).status,
    ).toBe(400)
    expect((await t.api('GET', '/api/support/classes', { token: agent })).status).toBe(400)
    expect(
      (await t.api('GET', `/api/support/classes?q=${'x'.repeat(121)}`, { token: agent })).status,
    ).toBe(400)
    // a wildcard is a character, not a pattern
    expect((await t.api('GET', '/api/support/classes?q=%25', { token: agent })).body).toEqual({
      items: [],
    })
  })
})

describe('one class and one block', () => {
  it('reads the class with its profile and blocks', async () => {
    const res = await t.api('GET', `/api/support/classes/${classId}`, { token: agent })
    expect(res.status).toBe(200)
    expect(res.body.class).toMatchObject({
      id: classId,
      profile: { id: profileId, displayName: 'Clay Corner' },
      viewerIsInstructor: false,
      venue: { lat: 1.29, lng: 103.85, accuracyM: 10, radiusM: 200 },
    })
    expect(res.body.class.blocks[0].mix).toMatchObject({
      enrolled: 4,
      selfCheckIn: 1,
      flaggedOther: 1,
      markedByHand: 1,
      notArrived: 1,
    })
  })

  it('reads a block with attempts by reason, each learner’s coordinates and events', async () => {
    const res = await t.api('GET', `/api/support/classes/${classId}/blocks/${blockId}`, {
      token: agent,
    })
    expect(res.status).toBe(200)
    const { block } = res.body
    expect(block.block.id).toBe(blockId)
    expect(block.attemptsByReason).toEqual({
      code_wrong: 2,
      code_expired: 0,
      not_open_yet: 0,
      closed: 0,
      too_many_attempts: 0,
    })
    const row = (id: string | undefined) =>
      block.learners.find((l: { enrollmentId: string }) => l.enrollmentId === id)
    expect(row(enrollments.reader)).toMatchObject({
      state: 'present',
      coordinates: { lat: 1.2901, lng: 103.8502 },
    })
    expect(row(enrollments.refuser)).toMatchObject({
      state: 'present_flagged',
      flagReason: 'denied',
      coordinates: null,
    })
    expect(row(enrollments.wrong)).toMatchObject({
      state: 'not_arrived',
      lastRefusal: { reason: 'code_wrong' },
      coordinates: { lat: 1.3, lng: 103.9 },
    })
    expect(row(enrollments.marked).events).toEqual([
      expect.objectContaining({
        type: 'manual_mark',
        actorName: 'owner@example.com',
        reasonCode: 'no_network',
      }),
    ])
  })

  it('shows erased coordinates once the location row is deleted', async () => {
    const checkIn = await t.db.query.attendanceEvents.findFirst({
      where: { enrollmentId: enrollments.reader, type: 'check_in' },
    })
    // the API's database user may erase coordinates
    await t.db
      .delete(s.attendanceEventLocations)
      .where(eq(s.attendanceEventLocations.eventId, checkIn?.id as string))
    const res = await t.api('GET', `/api/support/classes/${classId}/blocks/${blockId}`, {
      token: agent,
    })
    const row = res.body.block.learners.find(
      (l: { enrollmentId: string }) => l.enrollmentId === enrollments.reader,
    )
    expect(row.coordinates).toBe('erased')
    // the event keeps its distance and accuracy
    expect(row).toMatchObject({ accuracyM: 9, state: 'present' })
    expect(row.distanceM).toBeGreaterThan(0)
  })

  it('shows a dispute decision with its outcome', async () => {
    const mark = await t.db.query.attendanceEvents.findFirst({
      where: { enrollmentId: enrollments.marked, type: 'manual_mark' },
    })
    const learner = (await t.signIn('marked@example.com')).token
    const disputed = await t.api('POST', `/api/me/classes/attendance/${mark?.id}/dispute`, {
      token: learner,
      body: { reason: 'I was not there that day.' },
    })
    expect(disputed.status).toBe(200)
    const dispute = await t.db.query.attendanceEvents.findFirst({
      where: { enrollmentId: enrollments.marked, type: 'dispute' },
    })
    const owner = (await t.signIn('owner@example.com', 'teach')).token
    const decided = await t.api(
      'POST',
      `/api/teach/profiles/${profileId}/classes/${classId}/disputes/${dispute?.id}/decision`,
      { token: owner, body: { decision: 'voided', reason: 'The learner was away.' } },
    )
    expect(decided.status).toBe(200)

    const res = await t.api('GET', `/api/support/classes/${classId}/blocks/${blockId}`, {
      token: agent,
    })
    const events = res.body.block.learners.find(
      (l: { enrollmentId: string }) => l.enrollmentId === enrollments.marked,
    ).events
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'manual_mark', decision: null }),
        expect.objectContaining({ type: 'dispute_decision', decision: 'voided' }),
      ]),
    )
  })

  it('answers 404 for an unknown class or a block of another class', async () => {
    const other = await t.db.query.classes.findFirst({ where: { name: 'Evening glaze class' } })
    const otherBlock = await t.db.query.classBlocks.findFirst({
      where: { classId: other?.id as string },
    })
    expect(
      (
        await t.api('GET', `/api/support/classes/${classId}/blocks/${otherBlock?.id}`, {
          token: agent,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await t.api('GET', '/api/support/classes/00000000-0000-4000-8000-000000000000', {
          token: agent,
        })
      ).status,
    ).toBe(404)
  })
})

describe('who may read', () => {
  it('refuses anyone who is not staff', async () => {
    const learner = (await t.signIn('reader@example.com')).token
    const owner = (await t.signIn('owner@example.com', 'teach')).token
    for (const token of [learner, owner]) {
      for (const path of [
        '/api/support/features',
        '/api/support/classes?q=weekend',
        `/api/support/classes/${classId}`,
        `/api/support/classes/${classId}/blocks/${blockId}`,
      ]) {
        expect((await t.api('GET', path, { token })).status, path).toBe(403)
      }
    }
    expect((await t.api('GET', `/api/support/classes/${classId}`)).status).toBe(401)
  })

  it('has no write route under /support/classes', async () => {
    const writes = t.app.routes.filter(
      (r) => r.path.startsWith('/api/support/classes') && !['GET', 'ALL'].includes(r.method),
    )
    expect(writes).toEqual([])
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await t.api(method, `/api/support/classes/${classId}`, {
        token: agent,
        body: {},
      })
      expect(res.status, method).toBe(404)
    }
  })
})
