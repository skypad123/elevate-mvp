import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * What a class enrollment can and cannot do (docs/designs/scheduled-classes-attendance.md): every
 * existing learner route keeps meaning "self-paced". A learner with both kinds of enrollment for
 * one course sees only the self-paced one, and the class enrollment opens no lesson, progress,
 * quiz or certificate.
 */
let t: TestApp
let course: Awaited<ReturnType<TestApp['createCourse']>>
let classId: string
let token: string
let selfPacedId: string
let classEnrollmentId: string

beforeAll(async () => {
  t = await createTestApp()
  const profileId = (await t.createProfile('owner@example.com', { payable: true })).profile.id
  course = await t.createCourse(profileId, { status: 'live' })
  ;({ classId } = await t.createClass(profileId, course.courseId))
  selfPacedId = (await t.enrol('both@example.com', course.courseId)).id
  classEnrollmentId = (await t.enrolInClass('both@example.com', classId)).id
  token = (await t.signIn('both@example.com')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('a learner with a self-paced and a class enrollment for one course', () => {
  it('sees only the self-paced one in My Learning and on the course page', async () => {
    const mine = await t.api('GET', '/api/me/enrollments', { token })
    expect(mine.status).toBe(200)
    expect(mine.body.items.map((e: { id: string }) => e.id)).toEqual([selfPacedId])
    const page = await t.api('GET', `/api/catalog/courses/${course.slug}`, { token })
    expect(page.status).toBe(200)
    expect(page.body.course.viewer.enrollmentId).toBe(selfPacedId)
  })

  it('opens the course through the self-paced enrollment and nothing through the class one', async () => {
    expect((await t.api('GET', `/api/me/enrollments/${selfPacedId}`, { token })).status).toBe(200)
    const base = `/api/me/enrollments/${classEnrollmentId}`
    const routes: [string, string, unknown?][] = [
      ['GET', base],
      ['GET', `${base}/lessons/${course.lessonA}`],
      ['POST', `${base}/artefacts/${course.textArtefactId}/progress`, { status: 'completed' }],
      ['POST', `${base}/quizzes/${course.quizId}/attempts`],
      [
        'POST',
        `${base}/quizzes/${course.quizId}/attempts/00000000-0000-4000-8000-000000000000/submit`,
        { answers: {} },
      ],
      ['GET', `${base}/certificate`],
    ]
    for (const [method, path, body] of routes) {
      const res = await t.api(method, path, { token, body })
      expect(res.status, `${method} ${path}`).toBe(404)
    }
    expect(
      await t.db.query.artefactProgress.findMany({ where: { enrollmentId: classEnrollmentId } }),
    ).toEqual([])
  })

  it('earns no certificate through the class enrollment, even once completed', async () => {
    await t.db
      .update(s.enrollments)
      .set({ completedAt: t.now() })
      .where(eq(s.enrollments.id, classEnrollmentId))
    const res = await t.api('GET', `/api/me/enrollments/${classEnrollmentId}/certificate`, {
      token,
    })
    expect(res.status).toBe(404)
    expect(
      await t.db.query.certificates.findMany({ where: { enrollmentId: classEnrollmentId } }),
    ).toEqual([])
  })

  it('is already enrolled for checkout through the self-paced row only', async () => {
    const again = await t.api('POST', `/api/checkout/courses/${course.courseId}`, {
      token,
      body: {},
    })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('already_enrolled')

    // a learner with only a class enrollment can buy the self-paced course, on a new row
    await t.enrolInClass('class-only@example.com', classId)
    const classOnly = (await t.signIn('class-only@example.com')).token
    const start = await t.api('POST', `/api/checkout/courses/${course.courseId}`, {
      token: classOnly,
      body: {},
    })
    expect(start.status).toBe(200)
    const user = await t.ensureUser('class-only@example.com')
    const rows = await t.db.query.enrollments.findMany({ where: { userId: user.id } })
    expect(rows.map((r) => [r.classId, r.status]).sort()).toEqual(
      [
        [classId, 'active'],
        [null, 'pending_payment'],
      ].sort(),
    )
  })

  it('leaves class enrollments out of the Support numbers', async () => {
    await t.grantRole('agent@example.com', 'support_agent')
    const agent = (await t.signIn('agent@example.com', 'support')).token
    const user = await t.ensureUser('both@example.com')
    const person = await t.api('GET', `/api/support/people/${user.id}`, { token: agent })
    expect(person.body.person.stats.enrollments).toBe(1)
    const analytics = await t.api('GET', '/api/support/analytics', { token: agent })
    // one active self-paced enrollment; the completed class enrollment is not counted
    expect(analytics.body.analytics.completion).toMatchObject({ enrolled: 1, completed: 0 })
    const row = analytics.body.analytics.courses.find(
      (c: { courseId: string }) => c.courseId === course.courseId,
    )
    expect(row).toMatchObject({ enrolled: 1, completed: 0 })
  })
})
