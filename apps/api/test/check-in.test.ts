import { CODE_PERIOD_MS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Check-in (docs/designs/scheduled-classes-attendance.md, "Check-in"): its eight steps, each
 * refusal as stored and as answered, and where a reading's coordinates end up.
 */
let t: TestApp
let profileId: string
let courseId: string
/** An in-person class with its venue at VENUE and one block open now. */
let classId: string
let blockId: string

const VENUE = { lat: 1.29, lng: 103.85 }
const MINUTE = 60_000
let learners = 0

beforeAll(async () => {
  t = await createTestApp()
  profileId = (await t.createProfile('owner@example.com')).profile.id
  courseId = (await t.createCourse(profileId, { status: 'live' })).courseId
  ;({ classId, blockId } = await t.createClass(profileId, courseId, {
    venue: { ...VENUE, accuracyM: 10 },
  }))
})
afterAll(async () => {
  await t.close()
})

/** A new learner in the class, signed in. */
async function learnerIn(theClass = classId) {
  const email = `checkin-learner-${++learners}@example.com`
  const enrollment = await t.enrolInClass(email, theClass)
  const token = (await t.signIn(email)).token as string
  return { email, enrollment, token }
}

function checkIn(
  token: string,
  block: string,
  body: Partial<{ code: string; method: string; location: unknown }> = {},
) {
  return t.api('POST', `/api/me/classes/blocks/${block}/check-in`, {
    token,
    body: {
      method: 'typed_code',
      platform: 'web',
      location: { status: 'denied' },
      ...body,
    },
  })
}

const eventsOf = (enrollmentId: string) =>
  t.db.query.attendanceEvents.findMany({
    where: { enrollmentId },
    orderBy: { createdAt: 'asc' },
  })

describe('the check-in window', () => {
  it('opens exactly 30 minutes before the block starts and refuses a moment earlier', async () => {
    const start = 30 * MINUTE
    const atEdge = await t.createClass(profileId, courseId, {
      blocks: [{ startMs: start, endMs: start + 60 * MINUTE }],
    })
    const early = await t.createClass(profileId, courseId, {
      blocks: [{ startMs: start + 1, endMs: start + 60 * MINUTE }],
    })
    const a = await learnerIn(atEdge.classId)
    const ok = await checkIn(a.token, atEdge.blockId, {
      code: await t.validCodeFor(atEdge.blockId),
    })
    expect(ok.status).toBe(200)

    const b = await learnerIn(early.classId)
    const refused = await checkIn(b.token, early.blockId, {
      code: await t.validCodeFor(early.blockId),
    })
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('check_in_not_open')
    expect(refused.body.error.details).toEqual({
      opensAt: new Date(t.now().getTime() + 1).toISOString(),
    })
    const [stored] = await eventsOf(b.enrollment.id)
    expect(stored).toMatchObject({ type: 'attempt_refused', refusalReason: 'not_open_yet' })
  })

  it('closes exactly 30 minutes after the block ends and refuses a moment later', async () => {
    const end = -30 * MINUTE
    const atEdge = await t.createClass(profileId, courseId, {
      blocks: [{ startMs: end - 60 * MINUTE, endMs: end }],
    })
    const late = await t.createClass(profileId, courseId, {
      blocks: [{ startMs: end - 60 * MINUTE, endMs: end - 1 }],
    })
    const a = await learnerIn(atEdge.classId)
    expect(
      (await checkIn(a.token, atEdge.blockId, { code: await t.validCodeFor(atEdge.blockId) }))
        .status,
    ).toBe(200)

    const b = await learnerIn(late.classId)
    const refused = await checkIn(b.token, late.blockId, {
      code: await t.validCodeFor(late.blockId),
    })
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('check_in_closed')
    expect(refused.body.error.details).toEqual({
      closesAt: new Date(t.now().getTime() - 1).toISOString(),
    })
    const [stored] = await eventsOf(b.enrollment.id)
    expect(stored).toMatchObject({ type: 'attempt_refused', refusalReason: 'closed' })
  })
})

describe('wrong and expired codes', () => {
  it('counts attempts down from 4 to 0, then locks the learner out', async () => {
    const { token, enrollment } = await learnerIn()
    const expired = await t.validCodeFor(blockId, new Date(t.now().getTime() - 3 * MINUTE))
    const left: number[] = []
    for (const [i, code] of ['WRONG2', expired, 'ZZZZZZ', expired, 'WRONG3'].entries()) {
      const res = await checkIn(token, blockId, { code })
      expect(res.status, `attempt ${i + 1}`).toBe(422)
      expect(res.body.error.code).toBe(
        code === expired ? 'check_in_code_expired' : 'check_in_code_wrong',
      )
      left.push(res.body.error.details.attemptsLeft)
    }
    expect(left).toEqual([4, 3, 2, 1, 0])

    // the sixth is refused before the code is read, even with the right one
    const locked = await checkIn(token, blockId, { code: await t.validCodeFor(blockId) })
    expect(locked.status).toBe(429)
    expect(locked.body.error.code).toBe('check_in_locked')
    expect(locked.body.error.details).toEqual({
      lockedUntil: new Date(t.now().getTime() + 5 * MINUTE).toISOString(),
    })

    const reasons = (await eventsOf(enrollment.id)).map((e) => [e.type, e.refusalReason])
    expect(reasons).toEqual([
      ['attempt_refused', 'code_wrong'],
      ['attempt_refused', 'code_expired'],
      ['attempt_refused', 'code_wrong'],
      ['attempt_refused', 'code_expired'],
      ['attempt_refused', 'code_wrong'],
      ['attempt_refused', 'too_many_attempts'],
    ])
    // the roster shows the lockout
    const roster = await t.api(
      'GET',
      `/api/teach/profiles/${profileId}/classes/${classId}/blocks/${blockId}/roster`,
      { token: (await t.signIn('owner@example.com', 'teach')).token },
    )
    const row = roster.body.roster.learners.find(
      (l: { enrollmentId: string }) => l.enrollmentId === enrollment.id,
    )
    expect(row.lockedUntil).toBe(locked.body.error.details.lockedUntil)
    expect(row.lastRefusal.reason).toBe('too_many_attempts')
  })

  it('accepts the code of the current period and the one before, as typed or from the link', async () => {
    const a = await learnerIn()
    const previous = await t.validCodeFor(blockId, new Date(t.now().getTime() - CODE_PERIOD_MS))
    expect((await checkIn(a.token, blockId, { code: previous })).status).toBe(200)
    const b = await learnerIn()
    const link = await t.validCodeFor(blockId, undefined, 'link')
    const res = await checkIn(b.token, blockId, { code: link, method: 'qr_link' })
    expect(res.status).toBe(200)
    const [event] = await eventsOf(b.enrollment.id)
    expect(event).toMatchObject({ type: 'check_in', method: 'qr_link' })
  })

  it('takes a typed code in lower case with spaces and dashes', async () => {
    const { token } = await learnerIn()
    const code = await t.validCodeFor(blockId)
    const messy = `${code.slice(0, 3).toLowerCase()} - ${code.slice(3)}`
    expect((await checkIn(token, blockId, { code: messy })).status).toBe(200)
  })
})

describe('a check-in', () => {
  it('stores one check-in with the matched period, and a repeat answers 200 storing nothing', async () => {
    const { token, enrollment } = await learnerIn()
    const code = await t.validCodeFor(blockId)
    const first = await checkIn(token, blockId, {
      code,
      location: { status: 'unsupported' },
    })
    expect(first.status).toBe(200)
    expect(first.body.result).toEqual({
      state: 'present_flagged',
      flagReason: 'unsupported',
      checkedInAt: t.now().toISOString(),
    })
    const again = await checkIn(token, blockId, { code: 'WRONG2' })
    expect(again.status).toBe(200)
    expect(again.body.result).toEqual(first.body.result)
    const events = await eventsOf(enrollment.id)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'check_in',
      actorRole: 'learner',
      learnerUserId: enrollment.userId,
      codePeriod: Math.floor(t.now().getTime() / CODE_PERIOD_MS),
      createdAt: t.now(),
    })
  })

  it('works out each location status', async () => {
    const offset = (metres: number) => ({ lat: VENUE.lat + metres / 111_320, lng: VENUE.lng })
    const cases: [unknown, string][] = [
      [{ ...offset(50), accuracyM: 20 }, 'ok'],
      [{ ...offset(4000), accuracyM: 20 }, 'out_of_range'],
      [{ ...offset(50), accuracyM: 600 }, 'inaccurate'],
      [{ status: 'denied' }, 'denied'],
      [{ status: 'unavailable' }, 'unavailable'],
      [{ status: 'unsupported' }, 'unsupported'],
    ]
    for (const [location, status] of cases) {
      const { token, enrollment } = await learnerIn()
      const res = await checkIn(token, blockId, { code: await t.validCodeFor(blockId), location })
      expect(res.status, status).toBe(200)
      expect(res.body.result.state).toBe(status === 'ok' ? 'present' : 'present_flagged')
      const [event] = await eventsOf(enrollment.id)
      expect(event?.locationStatus).toBe(status)
    }
  })

  it('needs no location in a remote class, and keeps none sent', async () => {
    const remote = await t.createClass(profileId, courseId, { delivery: 'remote' })
    const { token, enrollment } = await learnerIn(remote.classId)
    const res = await checkIn(token, remote.blockId, {
      code: await t.validCodeFor(remote.blockId),
      location: { lat: 1.3, lng: 103.8, accuracyM: 15 },
    })
    expect(res.status).toBe(200)
    expect(res.body.result.state).toBe('present')
    const [event] = await eventsOf(enrollment.id)
    expect(event).toMatchObject({ locationStatus: 'not_required', accuracyM: null })
    const locations = await t.db.query.attendanceEventLocations.findMany({
      where: { eventId: event?.id as string },
    })
    expect(locations).toEqual([])
  })

  it('answers 404 and stores nothing for a learner with no class enrollment', async () => {
    const stranger = (await t.signIn('not-in-the-class@example.com')).token as string
    const before = await t.db.select({ n: count() }).from(s.attendanceEvents)
    const res = await checkIn(stranger, blockId, { code: await t.validCodeFor(blockId) })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('not_found')
    // a self-paced enrollment in the same course is not a class enrollment
    await t.enrol('not-in-the-class@example.com', courseId)
    expect((await checkIn(stranger, blockId, { code: 'WRONG2' })).status).toBe(404)
    // nor is one in another class
    const other = await t.createClass(profileId, courseId)
    await t.enrolInClass('not-in-the-class@example.com', other.classId)
    expect((await checkIn(stranger, blockId, { code: 'WRONG2' })).status).toBe(404)
    // an unknown block is the same
    expect(
      (await checkIn(stranger, '00000000-0000-4000-8000-000000000000', { code: 'WRONG2' })).status,
    ).toBe(404)
    const after = await t.db.select({ n: count() }).from(s.attendanceEvents)
    expect(after).toEqual(before)
  })

  it('refuses a check-in after an overturn, storing nothing', async () => {
    const { token, enrollment } = await learnerIn()
    await checkIn(token, blockId, { code: await t.validCodeFor(blockId) })
    const owner = (await t.signIn('owner@example.com', 'teach')).token
    const overturned = await t.api(
      'POST',
      `/api/teach/profiles/${profileId}/classes/${classId}/blocks/${blockId}/learners/${enrollment.id}/overturn`,
      { token: owner, body: { reasonCode: 'not_in_room' } },
    )
    expect(overturned.status).toBe(200)
    const again = await checkIn(token, blockId, { code: await t.validCodeFor(blockId) })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('check_in_overturned')
    expect((await eventsOf(enrollment.id)).map((e) => e.type)).toEqual(['check_in', 'overturn'])
  })

  it('keeps the coordinates in the side table and nowhere else', async () => {
    const { token, enrollment } = await learnerIn()
    const reading = { lat: 1.290_123, lng: 103.850_456, accuracyM: 12 }
    const res = await checkIn(token, blockId, {
      code: await t.validCodeFor(blockId),
      location: reading,
    })
    expect(res.status).toBe(200)
    const [event] = await eventsOf(enrollment.id)
    expect(event).toMatchObject({ locationStatus: 'ok', accuracyM: 12 })
    expect(event?.distanceM).toBeGreaterThan(0)
    // the event keeps the venue it was judged against, not the reading
    expect(event).toMatchObject({ venueLat: VENUE.lat, venueLng: VENUE.lng, venueRadiusM: 200 })
    const location = await t.db.query.attendanceEventLocations.findFirst({
      where: { eventId: event?.id as string },
    })
    expect(location).toMatchObject({ lat: reading.lat, lng: reading.lng })

    // neither the learner's answers, the roster nor the audit log carries the reading
    const owner = (await t.signIn('owner@example.com', 'teach')).token
    const answers = [
      res.body,
      (await t.api('GET', '/api/me/classes', { token })).body,
      (await t.api('GET', `/api/me/classes/blocks/${blockId}`, { token })).body,
      (
        await t.api(
          'GET',
          `/api/teach/profiles/${profileId}/classes/${classId}/blocks/${blockId}/roster`,
          { token: owner },
        )
      ).body,
      (await t.api('GET', `/api/teach/profiles/${profileId}/classes/${classId}`, { token: owner }))
        .body,
      await t.db.select().from(s.auditLog),
    ]
    for (const answer of answers) {
      const text = JSON.stringify(answer)
      expect(text).not.toContain('290123')
      expect(text).not.toContain('850456')
    }
  })

  it('stores a refused attempt with its reading', async () => {
    const { token, enrollment } = await learnerIn()
    const res = await checkIn(token, blockId, {
      code: 'WRONG2',
      location: { lat: 1.2901, lng: 103.8501, accuracyM: 30 },
    })
    expect(res.status).toBe(422)
    const [event] = await eventsOf(enrollment.id)
    expect(event).toMatchObject({ type: 'attempt_refused', locationStatus: 'ok', accuracyM: 30 })
    const location = await t.db
      .select()
      .from(s.attendanceEventLocations)
      .where(eq(s.attendanceEventLocations.eventId, event?.id as string))
    expect(location).toHaveLength(1)
  })
})

describe('the check-in screen', () => {
  it('reads the block, whether location is asked, and the learner state', async () => {
    const { token, enrollment } = await learnerIn()
    const res = await t.api('GET', `/api/me/classes/blocks/${blockId}`, { token })
    expect(res.status).toBe(200)
    expect(res.body.context).toMatchObject({
      blockId,
      enrollmentId: enrollment.id,
      timeZone: 'Asia/Singapore',
      asksLocation: true,
      state: 'not_arrived',
    })
    expect(JSON.stringify(res.body)).not.toContain('codeSecret')
    const stranger = (await t.signIn('screen-stranger@example.com')).token
    expect(
      (await t.api('GET', `/api/me/classes/blocks/${blockId}`, { token: stranger })).status,
    ).toBe(404)
  })
})
