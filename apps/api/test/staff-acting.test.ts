import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * A `super_admin` opening a teacher's profile in Teach acts as staff: they can fix content and
 * read the profile, and every change they make is on record under their own user. Money,
 * publishing and Stripe stay with the teacher.
 */
let t: TestApp
let owner: string
let staff: string
let staffUserId: string
let agent: string
let profileId: string
let fixture: Awaited<ReturnType<TestApp['createCourse']>>

const teach = (path: string) => `/api/teach/profiles/${profileId}${path}`

const quiz = {
  passMarkPercent: 60,
  questions: [
    {
      id: 'q1',
      prompt: 'Which glaze needs the hotter kiln?',
      options: [
        { id: 'a', text: 'Stoneware', correct: true },
        { id: 'b', text: 'Earthenware', correct: false },
      ],
    },
  ],
}

const staffAudit = async () =>
  (
    await t.db.query.auditLog.findMany({ where: { profileId }, orderBy: { createdAt: 'asc' } })
  ).filter((row) => row.action.startsWith('staff.'))

beforeAll(async () => {
  t = await createTestApp()
  const created = await t.createProfile('potter@example.com', {
    displayName: 'Clay Days',
    payable: true,
  })
  profileId = created.profile.id
  fixture = await t.createCourse(profileId)
  owner = (await t.signIn('potter@example.com', 'teach')).token as string
  staffUserId = (await t.grantRole('root@example.com', 'super_admin')).id
  staff = (await t.signIn('root@example.com', 'teach')).token as string
  await t.grantRole('agent@example.com', 'support_agent')
  agent = (await t.signIn('agent@example.com', 'teach')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('staff acting in Teach', () => {
  it('recognises a super admin as staff on a profile they do not belong to', async () => {
    const asStaff = await t.api('GET', teach('/profile'), { token: staff })
    expect(asStaff.status).toBe(200)
    expect(asStaff.body.profile).toMatchObject({ id: profileId, actingAsStaff: true })
    const asOwner = await t.api('GET', teach('/profile'), { token: owner })
    expect(asOwner.body.profile.actingAsStaff).toBe(false)
    // the profile is not one of the staff member's own
    expect((await t.api('GET', '/api/teach/profiles', { token: staff })).body.items).toEqual([])
    // a support agent is not staff here: Support reviews through its own routes
    expect((await t.api('GET', teach('/profile'), { token: agent })).status).toBe(404)
    expect((await t.api('GET', teach('/courses'), { token: agent })).status).toBe(404)
  })

  it('lets staff fix content, and records each change under their own user', async () => {
    const edited = await t.api('PUT', teach(`/artefacts/${fixture.quizArtefactId}/quiz`), {
      token: staff,
      body: quiz,
    })
    expect(edited.status).toBe(200)
    const lesson = await t.api('PATCH', teach(`/lessons/${fixture.lessonA}`), {
      token: staff,
      body: { title: 'First lesson, corrected' },
    })
    expect(lesson.status).toBe(200)
    const details = await t.api('PATCH', teach(`/courses/${fixture.courseId}`), {
      token: staff,
      body: { summary: 'A summary the support team tidied up for the teacher.' },
    })
    expect(details.status).toBe(200)

    const audit = await staffAudit()
    expect(audit.map((row) => row.action)).toEqual([
      'staff.PUT /teach/profiles/:profileId/artefacts/:id/quiz',
      'staff.PATCH /teach/profiles/:profileId/lessons/:id',
      'staff.PATCH /teach/profiles/:profileId/courses/:id',
    ])
    for (const row of audit) {
      expect(row).toMatchObject({
        actorId: staffUserId,
        profileId,
        entityType: 'profile',
        entityId: profileId,
      })
    }
    expect(audit[0]?.metadata).toEqual({
      method: 'PUT',
      path: teach(`/artefacts/${fixture.quizArtefactId}/quiz`),
    })
  })

  it('does not record reads, or changes the owner makes', async () => {
    const before = (await staffAudit()).length
    expect((await t.api('GET', teach('/courses'), { token: staff })).status).toBe(200)
    expect(
      (await t.api('GET', teach(`/courses/${fixture.courseId}`), { token: staff })).status,
    ).toBe(200)
    expect((await t.api('GET', teach('/earnings'), { token: staff })).status).toBe(200)
    await t.api('PATCH', teach(`/lessons/${fixture.lessonB}`), {
      token: owner,
      body: { title: 'Second lesson, by the owner' },
    })
    expect(await staffAudit()).toHaveLength(before)
  })

  it('refuses staff money, publishing and Stripe, and records nothing for a refusal', async () => {
    const before = (await staffAudit()).length
    const refused = [
      await t.api('PUT', teach(`/courses/${fixture.courseId}/price`), {
        token: staff,
        body: { priceCents: 100 },
      }),
      await t.api('DELETE', teach(`/courses/${fixture.courseId}`), { token: staff }),
      await t.api('POST', teach(`/courses/${fixture.courseId}/submit`), { token: staff }),
      await t.api('POST', teach('/courses'), {
        token: staff,
        body: { title: 'A course by staff', category: 'craft-making' },
      }),
      await t.api('POST', teach('/stripe/onboarding-link'), { token: staff }),
      await t.api('POST', teach('/stripe/login-link'), { token: staff }),
    ]
    expect(refused.map((r) => r.status)).toEqual([403, 403, 403, 403, 403, 403])
    expect(await staffAudit()).toHaveLength(before)
    // the price is what it was
    const course = await t.db.query.courses.findFirst({ where: { id: fixture.courseId } })
    expect(course?.priceCents).toBe(5000)
  })

  it('lets staff edit a live course and the profile itself', async () => {
    const live = await t.createCourse(profileId, { status: 'live', title: 'Live course' })
    const fixed = await t.api('PATCH', teach(`/artefacts/${live.textArtefactId}`), {
      token: staff,
      body: { title: 'Read this (typo fixed)' },
    })
    expect(fixed.status).toBe(200)
    const profile = await t.api('PATCH', teach('/profile'), {
      token: staff,
      body: { headline: 'Wheel-thrown ceramics, taught patiently' },
    })
    expect(profile.status).toBe(200)
    expect(profile.body.profile.actingAsStaff).toBe(true)
    const actions = (await staffAudit()).map((row) => row.action)
    expect(actions).toContain('staff.PATCH /teach/profiles/:profileId/artefacts/:id')
    expect(actions).toContain('staff.PATCH /teach/profiles/:profileId/profile')
  })

  it('leaves a course under review locked for staff as for the owner', async () => {
    const pending = await t.createCourse(profileId, { status: 'pending_review' })
    const res = await t.api('PATCH', teach(`/lessons/${pending.lessonA}`), {
      token: staff,
      body: { title: 'Not while it is under review' },
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('course_locked')
  })
})
