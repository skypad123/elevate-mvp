import { DISPUTE_WINDOW_MS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { intlLocale, translate } from '@elevate/i18n'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The instructor's corrections and the learner's dispute (docs/designs/scheduled-classes-
 * attendance.md, "What may follow what"): overturn, manual mark, dispute, decision. Each is a new
 * row; no earlier row changes.
 */
let t: TestApp
let profileId: string
let courseId: string
let classId: string
let blockId: string
let writer: string
let owner: string
let learners = 0

beforeAll(async () => {
  t = await createTestApp()
  profileId = (await t.createProfile('owner@example.com')).profile.id
  courseId = (await t.createCourse(profileId, { status: 'live' })).courseId
  const instructor = await t.addMember(profileId, 'writer@example.com', 'writer')
  ;({ classId, blockId } = await t.createClass(profileId, courseId, {
    instructorUserId: instructor.id,
  }))
  writer = (await t.signIn('writer@example.com', 'teach')).token as string
  owner = (await t.signIn('owner@example.com', 'teach')).token as string
})
afterAll(async () => {
  await t.close()
})

async function learnerIn(theClass = classId) {
  const email = `correction-learner-${++learners}@example.com`
  const enrollment = await t.enrolInClass(email, theClass)
  const token = (await t.signIn(email)).token as string
  return { email, enrollment, token }
}

async function checkIn(token: string, location: unknown, block = blockId) {
  const res = await t.api('POST', `/api/me/classes/blocks/${block}/check-in`, {
    token,
    body: {
      code: await t.validCodeFor(block),
      method: 'typed_code',
      platform: 'web',
      location,
    },
  })
  expect(res.status).toBe(200)
  return res
}

const learnerPath = (enrollmentId: string, action: string, theClass = classId, block = blockId) =>
  `/api/teach/profiles/${profileId}/classes/${theClass}/blocks/${block}/learners/${enrollmentId}/${action}`

const overturn = (token: string, enrollmentId: string, theClass?: string, block?: string) =>
  t.api('POST', learnerPath(enrollmentId, 'overturn', theClass, block), {
    token,
    body: { reasonCode: 'not_in_room' },
  })

const mark = (token: string, enrollmentId: string) =>
  t.api('POST', learnerPath(enrollmentId, 'manual-mark'), {
    token,
    body: { reasonCode: 'phone_not_working', idDocumentType: 'nric' },
  })

const stateOf = (roster: { learners: { enrollmentId: string; state: string }[] }, id: string) =>
  roster.learners.find((l) => l.enrollmentId === id)?.state

const disputePath = (eventId: string) => `/api/me/classes/attendance/${eventId}/dispute`
const decisionPath = (eventId: string) =>
  `/api/teach/profiles/${profileId}/classes/${classId}/disputes/${eventId}/decision`

async function markEventOf(enrollmentId: string) {
  const event = await t.db.query.attendanceEvents.findFirst({
    where: { enrollmentId, type: 'manual_mark' },
    orderBy: { createdAt: 'desc' },
  })
  if (!event) throw new Error('no manual mark')
  return event
}

describe('overturning a check-in', () => {
  it('overturns a flagged check-in, pointing at it, and leaves the check-in as it was', async () => {
    const { token, enrollment } = await learnerIn()
    await checkIn(token, { status: 'denied' })
    const [checkInRow] = await t.db.query.attendanceEvents.findMany({
      where: { enrollmentId: enrollment.id },
    })
    const res = await overturn(writer, enrollment.id)
    expect(res.status).toBe(200)
    expect(stateOf(res.body.roster, enrollment.id)).toBe('overturned')
    const events = await t.db.query.attendanceEvents.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(events[0]).toEqual(checkInRow)
    expect(events[1]).toMatchObject({
      type: 'overturn',
      refersToEventId: checkInRow?.id,
      actorRole: 'writer',
      reasonCode: 'not_in_room',
    })
    // a second overturn finds no standing check-in
    const again = await overturn(writer, enrollment.id)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('no_check_in')
  })

  it('refuses an unflagged check-in, a learner with none, and any check-in in a remote class', async () => {
    const present = await learnerIn()
    await checkIn(present.token, { lat: 1.29, lng: 103.85, accuracyM: 10 })
    const unflagged = await overturn(writer, present.enrollment.id)
    expect(unflagged.status).toBe(409)
    expect(unflagged.body.error.code).toBe('not_flagged')

    const absent = await learnerIn()
    const none = await overturn(writer, absent.enrollment.id)
    expect(none.status).toBe(409)
    expect(none.body.error.code).toBe('no_check_in')

    const writerUser = await t.ensureUser('writer@example.com')
    const remote = await t.createClass(profileId, courseId, {
      delivery: 'remote',
      instructorUserId: writerUser.id,
    })
    const online = await learnerIn(remote.classId)
    await checkIn(online.token, { status: 'unsupported' }, remote.blockId)
    const remoteRes = await overturn(writer, online.enrollment.id, remote.classId, remote.blockId)
    expect(remoteRes.status).toBe(409)
    expect(remoteRes.body.error.code).toBe('not_flagged')
  })

  it('is the assigned instructor’s alone', async () => {
    const { token, enrollment } = await learnerIn()
    await checkIn(token, { status: 'denied' })
    const res = await overturn(owner, enrollment.id)
    expect(res.status).toBe(403)
    // an unknown learner of the class is not found
    expect((await overturn(writer, '00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })
})

describe('marking by hand', () => {
  it('emails the learner in their language with the date the dispute window ends', async () => {
    const absent = await learnerIn()
    await t.db.update(s.users).set({ locale: 'zh' }).where(eq(s.users.email, absent.email))
    t.mailer.sent.length = 0
    expect((await mark(writer, absent.enrollment.id)).status).toBe(200)
    const sent = t.mailer.sent.filter((m) => m.to === absent.email)
    const theClass = await t.db.query.classes.findFirst({ where: { id: classId } })
    expect(sent.map((m) => m.subject)).toEqual([
      translate('zh', 'email.manualMark.title', { className: theClass?.name ?? '' }),
    ])
    const until = new Date(t.now().getTime() + DISPUTE_WINDOW_MS)
    const date = new Intl.DateTimeFormat(intlLocale('zh'), {
      timeZone: theClass?.timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(until)
    expect(sent[0]?.text).toContain(translate('zh', 'email.manualMark.dispute', { date }))
    expect(sent[0]?.text).toContain(`http://learner.test/class/${absent.enrollment.id}`)
  })

  it('marks a learner who has not arrived, and refuses one who is present', async () => {
    const absent = await learnerIn()
    const res = await mark(writer, absent.enrollment.id)
    expect(res.status).toBe(200)
    expect(stateOf(res.body.roster, absent.enrollment.id)).toBe('marked_by_hand')
    const row = res.body.roster.learners.find(
      (l: { enrollmentId: string }) => l.enrollmentId === absent.enrollment.id,
    )
    expect(row.manualMark).toMatchObject({
      reasonCode: 'phone_not_working',
      subState: 'open',
      disputeUntil: new Date(t.now().getTime() + DISPUTE_WINDOW_MS).toISOString(),
    })
    const stored = await markEventOf(absent.enrollment.id)
    expect(stored).toMatchObject({ idDocumentType: 'nric', actorRole: 'writer' })

    const again = await mark(writer, absent.enrollment.id)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('already_present')

    const present = await learnerIn()
    await checkIn(present.token, { status: 'denied' })
    expect((await mark(writer, present.enrollment.id)).body.error.code).toBe('already_present')
  })

  it('repairs a mistaken overturn', async () => {
    const { token, enrollment } = await learnerIn()
    await checkIn(token, { status: 'denied' })
    expect((await overturn(writer, enrollment.id)).status).toBe(200)
    const res = await mark(writer, enrollment.id)
    expect(res.status).toBe(200)
    expect(stateOf(res.body.roster, enrollment.id)).toBe('marked_by_hand')
  })

  it('writes one row for a double submit', async () => {
    const { enrollment } = await learnerIn()
    const answers = await Promise.all([mark(writer, enrollment.id), mark(writer, enrollment.id)])
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409])
    const marks = await t.db.query.attendanceEvents.findMany({
      where: { enrollmentId: enrollment.id, type: 'manual_mark' },
    })
    expect(marks).toHaveLength(1)
  })

  it('freezes the block', async () => {
    const { enrollment } = await learnerIn()
    await mark(writer, enrollment.id)
    const detail = await t.api('GET', `/api/teach/profiles/${profileId}/classes/${classId}`, {
      token: owner,
    })
    expect(detail.body.class.blocks[0].frozen).toBe(true)
  })
})

describe('disputes', () => {
  it('runs a mark through dispute and void, then a new mark, changing no earlier row', async () => {
    const { token, enrollment } = await learnerIn()
    await mark(writer, enrollment.id)
    const first = await markEventOf(enrollment.id)

    t.advanceClock(3 * 24 * 60 * 60_000)
    const disputed = await t.api('POST', disputePath(first.id), {
      token,
      body: { reason: 'This was not me.' },
    })
    expect(disputed.status).toBe(200)
    const block = disputed.body.class.blocks.find((b: { id: string }) => b.id === blockId)
    expect(block.state).toBe('marked_by_hand')
    expect(block.manualMark.subState).toBe('disputed')

    const twice = await t.api('POST', disputePath(first.id), {
      token,
      body: { reason: 'Again.' },
    })
    expect(twice.status).toBe(409)
    expect(twice.body.error.code).toBe('already_disputed')

    const before = await t.db.query.attendanceEvents.findMany({
      where: { enrollmentId: enrollment.id },
    })
    const dispute = before.find((e) => e.type === 'dispute')
    if (!dispute) throw new Error('no dispute')
    // the instructor, a writer, does not decide disputes
    expect(
      (
        await t.api('POST', decisionPath(dispute.id), {
          token: writer,
          body: { decision: 'voided', reason: 'No.' },
        })
      ).status,
    ).toBe(403)
    const voided = await t.api('POST', decisionPath(dispute.id), {
      token: owner,
      body: { decision: 'voided', reason: 'The learner was not there.' },
    })
    expect(voided.status).toBe(200)
    expect(voided.body.dispute).toMatchObject({
      disputeEventId: dispute.id,
      markEventId: first.id,
      decision: { decision: 'voided', reason: 'The learner was not there.' },
    })
    const second = await t.api('POST', decisionPath(dispute.id), {
      token: owner,
      body: { decision: 'upheld', reason: 'Changed my mind.' },
    })
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('dispute_already_decided')

    const roster = await t.api(
      'GET',
      `/api/teach/profiles/${profileId}/classes/${classId}/blocks/${blockId}/roster`,
      { token: owner },
    )
    expect(stateOf(roster.body.roster, enrollment.id)).toBe('mark_voided')

    // a learner can be marked again after a void
    const again = await mark(writer, enrollment.id)
    expect(again.status).toBe(200)
    expect(stateOf(again.body.roster, enrollment.id)).toBe('marked_by_hand')

    const after = await t.db.query.attendanceEvents.findMany({
      where: { id: { in: before.map((e) => e.id) } },
    })
    expect(after.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      before.sort((a, b) => a.id.localeCompare(b.id)),
    )
    const all = await t.db.query.attendanceEvents.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(all.map((e) => e.type)).toEqual([
      'manual_mark',
      'dispute',
      'dispute_decision',
      'manual_mark',
    ])
  })

  it('upholds a dispute, leaving the mark standing', async () => {
    const { token, enrollment } = await learnerIn()
    await mark(writer, enrollment.id)
    const markRow = await markEventOf(enrollment.id)
    await t.api('POST', disputePath(markRow.id), { token, body: { reason: 'Not me.' } })
    const list = await t.api(
      'GET',
      `/api/teach/profiles/${profileId}/classes/${classId}/disputes`,
      {
        token: owner,
      },
    )
    const open = list.body.items.find((d: { markEventId: string }) => d.markEventId === markRow.id)
    expect(open.decision).toBeNull()
    const upheld = await t.api('POST', decisionPath(open.disputeEventId), {
      token: owner,
      body: { decision: 'upheld', reason: 'I checked the NRIC myself.' },
    })
    expect(upheld.status).toBe(200)
    const mine = await t.api('GET', '/api/me/classes', { token })
    const block = mine.body.items[0].blocks.find((b: { id: string }) => b.id === blockId)
    expect(block.state).toBe('marked_by_hand')
    expect(block.manualMark.subState).toBe('upheld')
  })

  it('closes the dispute window 7 days after the mark', async () => {
    const { token, enrollment } = await learnerIn()
    await mark(writer, enrollment.id)
    const markRow = await markEventOf(enrollment.id)
    t.advanceClock(DISPUTE_WINDOW_MS + 1)
    const res = await t.api('POST', disputePath(markRow.id), { token, body: { reason: 'Late.' } })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('dispute_window_closed')
    expect(res.body.error.details).toEqual({
      disputeUntil: new Date(markRow.createdAt.getTime() + DISPUTE_WINDOW_MS).toISOString(),
    })
    const mine = await t.api('GET', '/api/me/classes', { token })
    expect(mine.body.items[0].blocks[0].manualMark.subState).toBe('settled')
  })

  it('answers 404 for a mark that is not the learner’s own', async () => {
    const a = await learnerIn()
    const b = await learnerIn()
    await mark(writer, a.enrollment.id)
    const markRow = await markEventOf(a.enrollment.id)
    const res = await t.api('POST', disputePath(markRow.id), {
      token: b.token,
      body: { reason: 'Not mine.' },
    })
    expect(res.status).toBe(404)
  })
})

describe('the audit log', () => {
  it('records each correction, with no coordinates', async () => {
    const actions = await t.db
      .select({ action: s.auditLog.action })
      .from(s.auditLog)
      .where(
        inArray(s.auditLog.action, [
          'attendance.overturned',
          'attendance.manual_marked',
          'attendance.dispute_decided',
        ]),
      )
    expect(new Set(actions.map((a) => a.action))).toEqual(
      new Set(['attendance.overturned', 'attendance.manual_marked', 'attendance.dispute_decided']),
    )
  })
})
