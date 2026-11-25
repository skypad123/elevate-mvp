import { schema as s } from '@elevate/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Setting up a class in Teach (docs/designs/scheduled-classes-attendance.md, "Teach: classes and
 * the roster screen"): create, edit, the block rules, publishing, the instructor, deleting, and
 * who can see which class.
 */
let t: TestApp
let profileId: string
let liveCourseId: string
let draftCourseId: string
let owner: string
let writer: string
let writerId: string
let ownerId: string
let base: string

// The test clock is 2026-11-08 12:00 in Singapore.
const block = (date: string, startTime = '09:00', endTime = '17:00') => ({
  date,
  startTime,
  endTime,
})

beforeAll(async () => {
  t = await createTestApp()
  const created = await t.createProfile('owner@example.com')
  profileId = created.profile.id
  ownerId = created.user.id
  liveCourseId = (await t.createCourse(profileId, { status: 'live' })).courseId
  draftCourseId = (await t.createCourse(profileId)).courseId
  writerId = (await t.addMember(profileId, 'writer@example.com', 'writer')).id
  owner = (await t.signIn('owner@example.com', 'teach')).token as string
  writer = (await t.signIn('writer@example.com', 'teach')).token as string
  base = `/api/teach/profiles/${profileId}/classes`
})
afterAll(async () => {
  await t.close()
})

function create(body: Record<string, unknown> = {}, token = owner) {
  return t.api('POST', base, {
    token,
    body: {
      courseId: liveCourseId,
      name: 'March weekend class',
      delivery: 'in_person',
      venueAddress: '1 Clay Street',
      seats: 12,
      instructorUserId: writerId,
      blocks: [block('2026-11-20'), block('2026-11-21')],
      ...body,
    },
  })
}

const audits = (action: string, entityId: string) =>
  t.db.query.auditLog.findMany({ where: { action, entityId } })

describe('creating and editing', () => {
  it('creates a draft with its blocks as instants in Singapore time, each with its own secret', async () => {
    const res = await create()
    expect(res.status).toBe(200)
    const c = res.body.class
    expect(c).toMatchObject({
      name: 'March weekend class',
      status: 'draft',
      timeZone: 'Asia/Singapore',
      delivery: 'in_person',
      seats: 12,
      instructor: { userId: writerId, displayName: 'writer@example.com' },
      firstBlockStartsAt: '2026-11-20T01:00:00.000Z',
      lastBlockEndsAt: '2026-11-21T09:00:00.000Z',
      enrolledCount: 0,
      viewerIsInstructor: false,
      venue: null,
    })
    expect(c.blocks.map((b: { position: number }) => b.position)).toEqual([0, 1])
    expect(c.blocks[0]).toMatchObject({
      startsAt: '2026-11-20T01:00:00.000Z',
      endsAt: '2026-11-20T09:00:00.000Z',
      frozen: false,
      removable: true,
      checkInOpensAt: '2026-11-20T00:30:00.000Z',
      checkInClosesAt: '2026-11-20T09:30:00.000Z',
    })
    expect(JSON.stringify(res.body)).not.toContain('codeSecret')
    const rows = await t.db.query.classBlocks.findMany({ where: { classId: c.id } })
    expect(new Set(rows.map((r) => r.codeSecret)).size).toBe(2)
    expect(rows.every((r) => Buffer.from(r.codeSecret, 'base64url').length === 32)).toBe(true)
    expect(await audits('class.created', c.id)).toHaveLength(1)
  })

  it('edits fields and blocks, keeping the IDs of the blocks it is sent back', async () => {
    const c = (await create()).body.class
    const [first, second] = c.blocks
    const res = await t.api('PATCH', `${base}/${c.id}`, {
      token: owner,
      body: {
        name: 'Renamed',
        seats: 20,
        blocks: [
          { id: second.id, ...block('2026-11-22', '10:00', '12:00') },
          { id: first.id, ...block('2026-11-20') },
          block('2026-11-23'),
        ],
      },
    })
    expect(res.status).toBe(200)
    const updated = res.body.class
    expect(updated).toMatchObject({ name: 'Renamed', seats: 20 })
    expect(updated.blocks.map((b: { id: string }) => b.id).slice(0, 2)).toEqual([
      first.id,
      second.id,
    ])
    expect(updated.blocks[1].startsAt).toBe('2026-11-22T02:00:00.000Z')
    expect(updated.blocks).toHaveLength(3)
    // leaving a block out removes it
    const removed = await t.api('PATCH', `${base}/${c.id}`, {
      token: owner,
      body: { blocks: [{ id: first.id, ...block('2026-11-20') }] },
    })
    expect(removed.status).toBe(200)
    expect(removed.body.class.blocks.map((b: { id: string }) => b.id)).toEqual([first.id])
    // a draft edit is not audited; an unknown block ID is not found
    expect(await audits('class.updated', c.id)).toHaveLength(0)
    const unknown = await t.api('PATCH', `${base}/${c.id}`, {
      token: owner,
      body: { blocks: [{ id: '00000000-0000-4000-8000-000000000000', ...block('2026-11-20') }] },
    })
    expect(unknown.status).toBe(404)
  })

  it('reports each block problem with its index', async () => {
    const res = await create({
      blocks: [
        block('2026-11-20', '10:00', '10:00'),
        block('2026-11-21', '09:00', '12:00'),
        block('2026-11-21', '11:00', '13:00'),
        block('2026-11-22', '12:00', '13:00'),
      ],
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('blocks_invalid')
    expect(res.body.error.details.problems).toEqual([
      { index: 0, problem: 'end_not_after_start' },
      { index: 1, problem: 'overlaps' },
      { index: 2, problem: 'overlaps' },
    ])
    // more than 60 blocks is refused by the request schema before the service sees it
    const tooMany = await create({
      blocks: Array.from({ length: 61 }, (_, i) =>
        block(new Date(Date.UTC(2026, 11, 1 + i)).toISOString().slice(0, 10)),
      ),
    })
    expect(tooMany.status).toBe(400)
  })

  it('refuses an instructor who is not on the profile, and a course of another profile', async () => {
    const stranger = await t.ensureUser('not-a-member@example.com')
    const res = await create({ instructorUserId: stranger.id })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('instructor_not_member')
    const other = await t.createProfile('other-owner@example.com')
    const theirs = await t.createCourse(other.profile.id, { status: 'live' })
    expect((await create({ courseId: theirs.courseId })).status).toBe(404)
  })
})

describe('publishing', () => {
  it('reports every failed check together', async () => {
    const stranger = await t.ensureUser('publish-stranger@example.com')
    const empty = await t.createClass(profileId, draftCourseId, {
      status: 'draft',
      blocks: [],
      instructorUserId: stranger.id,
      venueAddress: null,
    })
    const res = await t.api('POST', `${base}/${empty.classId}/publish`, { token: owner })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('class_not_publishable')
    expect(res.body.error.details.problems.sort()).toEqual(
      [
        'course_not_published',
        'no_blocks',
        'instructor_not_member',
        'venue_address_missing',
      ].sort(),
    )
    const ended = await t.createClass(profileId, liveCourseId, {
      status: 'draft',
      blocks: [{ startMs: -3 * 60 * 60_000, endMs: -60 * 60_000 }],
    })
    const endedRes = await t.api('POST', `${base}/${ended.classId}/publish`, { token: owner })
    expect(endedRes.body.error.details.problems).toEqual(['block_ended'])
    // nothing was published
    const rows = await t.db.query.classes.findMany({
      where: { id: { in: [empty.classId, ended.classId] } },
    })
    expect(rows.every((r) => r.status === 'draft')).toBe(true)
  })

  it('publishes a class once; publishing again answers it unchanged', async () => {
    const c = (await create()).body.class
    const first = await t.api('POST', `${base}/${c.id}/publish`, { token: owner })
    expect(first.status).toBe(200)
    expect(first.body.class.status).toBe('published')
    t.advanceClock(60_000)
    const second = await t.api('POST', `${base}/${c.id}/publish`, { token: owner })
    expect(second.status).toBe(200)
    expect(second.body.class.publishedAt).toBe(first.body.class.publishedAt)
    expect(await audits('class.published', c.id)).toHaveLength(1)

    // after publishing: the name can change, the course and delivery cannot
    const renamed = await t.api('PATCH', `${base}/${c.id}`, {
      token: owner,
      body: { name: 'Still open for edits' },
    })
    expect(renamed.status).toBe(200)
    expect(await audits('class.updated', c.id)).toHaveLength(1)
    for (const body of [{ delivery: 'remote' }, { courseId: draftCourseId }]) {
      const res = await t.api('PATCH', `${base}/${c.id}`, { token: owner, body })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('class_published')
    }
    // and it cannot be deleted
    const deleted = await t.api('DELETE', `${base}/${c.id}`, { token: owner })
    expect(deleted.status).toBe(409)
    expect(deleted.body.error.code).toBe('class_published')
  })
})

describe('the instructor', () => {
  it('reassigns, audited, and refuses someone not on the profile', async () => {
    const c = (await create()).body.class
    const res = await t.api('PUT', `${base}/${c.id}/instructor`, {
      token: owner,
      body: { userId: ownerId },
    })
    expect(res.status).toBe(200)
    expect(res.body.class.instructor.userId).toBe(ownerId)
    expect(res.body.class.viewerIsInstructor).toBe(true)
    // the same instructor again changes nothing
    await t.api('PUT', `${base}/${c.id}/instructor`, { token: owner, body: { userId: ownerId } })
    const entries = await audits('class.instructor_changed', c.id)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.metadata).toEqual({ from: writerId, to: ownerId })
    const stranger = await t.ensureUser('reassign-stranger@example.com')
    const refused = await t.api('PUT', `${base}/${c.id}/instructor`, {
      token: owner,
      body: { userId: stranger.id },
    })
    expect(refused.status).toBe(422)
    expect(refused.body.error.code).toBe('instructor_not_member')
  })
})

describe('the freeze rule', () => {
  async function withEvent(type: 'check_in' | 'attempt_refused') {
    const c = await t.createClass(profileId, liveCourseId, {
      status: 'draft',
      blocks: [
        { startMs: 24 * 60 * 60_000, endMs: 25 * 60 * 60_000 },
        { startMs: 48 * 60 * 60_000, endMs: 49 * 60 * 60_000 },
      ],
    })
    const enrollment = await t.enrolInClass(`freeze-${type}-${c.classId}@example.com`, c.classId)
    await t.db.insert(s.attendanceEvents).values({
      classId: c.classId,
      blockId: c.blockId,
      enrollmentId: enrollment.id,
      learnerUserId: enrollment.userId,
      type,
      actorUserId: enrollment.userId,
      actorRole: 'learner',
      refusalReason: type === 'attempt_refused' ? 'code_wrong' : null,
      requestId: 'test',
      createdAt: t.now(),
    })
    const blocks = await t.db.query.classBlocks.findMany({
      where: { classId: c.classId },
      orderBy: { position: 'asc' },
    })
    return { ...c, blocks }
  }

  /** The block as the form would send it back, moved by `shiftHours`. */
  const asInput = (b: { id: string; startsAt: Date; endsAt: Date }, shiftHours = 0) => {
    const zoned = (d: Date) => {
      const sg = new Date(d.getTime() + 8 * 60 * 60_000 + shiftHours * 60 * 60_000)
      return { date: sg.toISOString().slice(0, 10), time: sg.toISOString().slice(11, 16) }
    }
    const start = zoned(b.startsAt)
    return { id: b.id, date: start.date, startTime: start.time, endTime: zoned(b.endsAt).time }
  }

  it('refuses moving or removing a block with a check-in, and does not freeze the others', async () => {
    const c = await withEvent('check_in')
    const [frozen, other] = c.blocks as [(typeof c.blocks)[0], (typeof c.blocks)[0]]
    const moved = await t.api('PATCH', `${base}/${c.classId}`, {
      token: owner,
      body: { blocks: [asInput(frozen, 1), asInput(other)] },
    })
    expect(moved.status).toBe(409)
    expect(moved.body.error).toMatchObject({
      code: 'block_frozen',
      details: { blockId: frozen.id },
    })
    const removed = await t.api('PATCH', `${base}/${c.classId}`, {
      token: owner,
      body: { blocks: [asInput(other)] },
    })
    expect(removed.status).toBe(409)
    expect(removed.body.error.code).toBe('block_frozen')
    const fine = await t.api('PATCH', `${base}/${c.classId}`, {
      token: owner,
      body: { blocks: [asInput(frozen), asInput(other, 2)] },
    })
    expect(fine.status).toBe(200)
    expect(fine.body.class.blocks.map((b: { frozen: boolean }) => b.frozen)).toEqual([true, false])
  })

  it('moves a block with only refused attempts, but does not remove it', async () => {
    const c = await withEvent('attempt_refused')
    const [tried, other] = c.blocks as [(typeof c.blocks)[0], (typeof c.blocks)[0]]
    const moved = await t.api('PATCH', `${base}/${c.classId}`, {
      token: owner,
      body: { blocks: [asInput(tried, 1), asInput(other)] },
    })
    expect(moved.status).toBe(200)
    expect(moved.body.class.blocks[0]).toMatchObject({ frozen: false, removable: false })
    expect(moved.body.class.blocks[1]).toMatchObject({ frozen: false, removable: true })
    const removed = await t.api('PATCH', `${base}/${c.classId}`, {
      token: owner,
      body: { blocks: [asInput(other)] },
    })
    expect(removed.status).toBe(409)
    expect(removed.body.error).toMatchObject({
      code: 'block_has_attempts',
      details: { blockId: tried.id },
    })
  })
})

describe('deleting', () => {
  it('deletes a draft class and its blocks', async () => {
    const c = (await create()).body.class
    const res = await t.api('DELETE', `${base}/${c.id}`, { token: owner })
    expect(res.status).toBe(200)
    expect(await t.db.query.classes.findFirst({ where: { id: c.id } })).toBeUndefined()
    expect(await t.db.query.classBlocks.findMany({ where: { classId: c.id } })).toEqual([])
    expect((await t.api('GET', `${base}/${c.id}`, { token: owner })).status).toBe(404)
  })
})

describe('who sees which class', () => {
  it('shows a writer only the classes they instruct', async () => {
    const theirs = (await create({ name: 'Taught by the writer' })).body.class
    const notTheirs = (await create({ name: 'Taught by the owner', instructorUserId: ownerId }))
      .body.class
    const list = await t.api('GET', base, { token: writer })
    const ids = list.body.items.map((c: { id: string }) => c.id)
    expect(ids).toContain(theirs.id)
    expect(ids).not.toContain(notTheirs.id)
    const mine = await t.api('GET', `${base}/${theirs.id}`, { token: writer })
    expect(mine.status).toBe(200)
    expect(mine.body.class.viewerIsInstructor).toBe(true)
    expect((await t.api('GET', `${base}/${notTheirs.id}`, { token: writer })).status).toBe(404)
    // the owner sees both
    const all = (await t.api('GET', base, { token: owner })).body.items.map(
      (c: { id: string }) => c.id,
    )
    expect(all).toEqual(expect.arrayContaining([theirs.id, notTheirs.id]))
  })

  it('answers 404 for a class of another profile', async () => {
    const c = (await create()).body.class
    const other = await t.createProfile('another-owner@example.com')
    const token = (await t.signIn('another-owner@example.com', 'teach')).token
    const path = `/api/teach/profiles/${other.profile.id}/classes/${c.id}`
    expect((await t.api('GET', path, { token })).status).toBe(404)
    expect((await t.api('PATCH', path, { token, body: { name: 'Taken' } })).status).toBe(404)
    expect((await t.api('DELETE', path, { token })).status).toBe(404)
    expect(
      (await t.api('GET', `/api/teach/profiles/${other.profile.id}/classes`, { token })).body,
    ).toEqual({ items: [] })
  })
})
