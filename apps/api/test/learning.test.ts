import { schema as s } from '@elevate/db'
import { seedDatabase } from '@elevate/db/seed'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let learner: string
let enrollmentId: string
let lessons: Array<{
  id: string
  title: string
  artefacts: Array<{ id: string; type: string; title: string }>
}>

const detail = async () =>
  (await t.api('GET', `/api/me/enrollments/${enrollmentId}`, { token: learner })).body.enrollment
const lessonContent = (lessonId: string) =>
  t.api('GET', `/api/me/enrollments/${enrollmentId}/lessons/${lessonId}`, { token: learner })
const progress = (artefactId: string, body: unknown) =>
  t.api('POST', `/api/me/enrollments/${enrollmentId}/artefacts/${artefactId}/progress`, {
    token: learner,
    body,
  })

beforeAll(async () => {
  t = await createTestApp()
  await seedDatabase(t.db, { superAdminEmail: 'admin@test.local', storageDir: null })
  const signed = await t.signIn('student@example.com')
  learner = signed.token as string
  const course = await t.db.query.courses.findFirst({
    where: { slug: 'sourdough-from-scratch' },
  })
  const [enrollment] = await t.db
    .insert(s.enrollments)
    .values({
      userId: signed.body.user.id,
      courseId: course?.id as string,
      status: 'active',
      enrolledAt: new Date(),
    })
    .returning()
  enrollmentId = enrollment?.id as string
})
afterAll(async () => {
  await t.close()
})

describe('lesson player', () => {
  it('reports lesson states from prerequisites and resume target', async () => {
    const e = await detail()
    lessons = e.lessons
    expect(e.lessons.map((l: { status: string }) => l.status)).toEqual([
      'available',
      'locked',
      'locked',
    ])
    expect(e.lessons[1].blockedBy).toEqual(['Building a starter'])
    expect(e.progress).toMatchObject({ percent: 0, isComplete: false })
    expect(e.progress.resume).toMatchObject({
      lessonId: lessons[0]!.id,
      artefactId: lessons[0]!.artefacts[0]!.id,
    })
    const other = (await t.signIn('intruder@example.com')).token as string
    expect(
      (await t.api('GET', `/api/me/enrollments/${enrollmentId}`, { token: other })).status,
    ).toBe(404)
  })

  it('serves unlocked lesson content without answer keys and blocks locked lessons', async () => {
    const open = await lessonContent(lessons[0]!.id)
    expect(open.status).toBe(200)
    const text = open.body.lesson.artefacts.find((a: { type: string }) => a.type === 'text')
    const quiz = open.body.lesson.artefacts.find((a: { type: string }) => a.type === 'quiz')
    expect(text.content.type).toBe('doc')
    expect(JSON.stringify(quiz.quiz)).not.toContain('correct')
    expect(quiz.attempts).toMatchObject({ used: 0, max: 2, passed: false, open: null })
    expect(open.body.lesson.next.status).toBe('locked')

    const locked = await lessonContent(lessons[1]!.id)
    expect(locked.status).toBe(403)
    expect(locked.body.error.code).toBe('lesson_locked')
    expect(locked.body.error.message).toContain('Building a starter')
  })

  it('records monotonic progress and positions', async () => {
    const textId = lessons[0]!.artefacts.find((a) => a.type === 'text')?.id as string
    const started = await progress(textId, { positionSeconds: 30 })
    expect(started.body.artefact).toMatchObject({ status: 'in_progress', positionSeconds: 30 })
    const done = await progress(textId, { status: 'completed' })
    expect(done.body.artefact.status).toBe('completed')
    const later = await progress(textId, { status: 'in_progress', positionSeconds: 5 })
    expect(later.body.artefact).toMatchObject({ status: 'completed', positionSeconds: 5 })
    const quizId = lessons[0]!.artefacts.find((a) => a.type === 'quiz')?.id as string
    expect((await progress(quizId, { status: 'completed' })).status).toBe(400)
    const lockedArtefact = lessons[1]!.artefacts[0]!.id
    expect((await progress(lockedArtefact, { status: 'completed' })).status).toBe(403)
    const e = await detail()
    expect(e.lessons[0].percent).toBe(50)
    expect(e.lessons[0].status).toBe('in_progress')
  })

  it('runs a quiz: fail, retry, pass, unlock the next lesson', async () => {
    const content = await lessonContent(lessons[0]!.id)
    const quizArtefact = content.body.lesson.artefacts.find(
      (a: { type: string }) => a.type === 'quiz',
    )
    const quizId: string = quizArtefact.quizId
    const start = await t.api(
      'POST',
      `/api/me/enrollments/${enrollmentId}/quizzes/${quizId}/attempts`,
      { token: learner },
    )
    expect(start.status).toBe(200)
    const attemptId: string = start.body.attempt.id
    // starting again returns the same open attempt
    const again = await t.api(
      'POST',
      `/api/me/enrollments/${enrollmentId}/quizzes/${quizId}/attempts`,
      { token: learner },
    )
    expect(again.body.attempt.id).toBe(attemptId)

    const questions: Array<{ id: string; options: Array<{ id: string }> }> =
      start.body.quiz.questions
    const quizRow = await t.db.query.quizzes.findFirst({ where: { id: quizId } })
    const key = new Map(
      quizRow?.questionsJson.map((q) => [q.id, q.options.find((o) => o.correct)?.id]),
    )
    const wrong = Object.fromEntries(
      questions.map((q) => [q.id, q.options.find((o) => o.id !== key.get(q.id))?.id]),
    )
    const fail = await t.api(
      'POST',
      `/api/me/enrollments/${enrollmentId}/quizzes/${quizId}/attempts/${attemptId}/submit`,
      { token: learner, body: { answers: wrong } },
    )
    expect(fail.status).toBe(200)
    expect(fail.body.passed).toBe(false)
    expect(fail.body.grade.scorePercent).toBe(0)
    expect(fail.body.attemptsRemaining).toBe(1)
    expect(
      (
        await t.api(
          'POST',
          `/api/me/enrollments/${enrollmentId}/quizzes/${quizId}/attempts/${attemptId}/submit`,
          { token: learner, body: { answers: wrong } },
        )
      ).status,
    ).toBe(409)

    const second = await t.api(
      'POST',
      `/api/me/enrollments/${enrollmentId}/quizzes/${quizId}/attempts`,
      { token: learner },
    )
    const right = Object.fromEntries(questions.map((q) => [q.id, key.get(q.id)]))
    const pass = await t.api(
      'POST',
      `/api/me/enrollments/${enrollmentId}/quizzes/${quizId}/attempts/${second.body.attempt.id}/submit`,
      { token: learner, body: { answers: right } },
    )
    expect(pass.body.passed).toBe(true)
    expect(pass.body.grade.scorePercent).toBe(100)
    expect(pass.body.grade.perQuestion.every((q: { correct: boolean }) => q.correct)).toBe(true)

    const e = await detail()
    expect(e.lessons[0].status).toBe('completed')
    expect(e.lessons[1].status).toBe('available')
    expect(e.progress.resume.lessonId).toBe(lessons[1]!.id)
    expect(
      (
        await t.api('POST', `/api/me/enrollments/${enrollmentId}/quizzes/${quizId}/attempts`, {
          token: learner,
        })
      ).status,
    ).toBe(409)
  })

  it('completes the course once every lesson and quiz is done', async () => {
    for (const lesson of lessons.slice(1)) {
      for (const artefact of lesson.artefacts) {
        if (artefact.type === 'text') await progress(artefact.id, { status: 'completed' })
      }
      const content = await lessonContent(lesson.id)
      const quizArtefact = content.body.lesson.artefacts.find(
        (a: { type: string }) => a.type === 'quiz',
      )
      if (quizArtefact) {
        const start = await t.api(
          'POST',
          `/api/me/enrollments/${enrollmentId}/quizzes/${quizArtefact.quizId}/attempts`,
          { token: learner },
        )
        const quizRow = await t.db.query.quizzes.findFirst({
          where: { id: quizArtefact.quizId },
        })
        const right = Object.fromEntries(
          (quizRow?.questionsJson ?? []).map((q) => [q.id, q.options.find((o) => o.correct)?.id]),
        )
        const res = await t.api(
          'POST',
          `/api/me/enrollments/${enrollmentId}/quizzes/${quizArtefact.quizId}/attempts/${start.body.attempt.id}/submit`,
          { token: learner, body: { answers: right } },
        )
        expect(res.body.passed).toBe(true)
      }
    }
    const e = await detail()
    expect(e.progress.isComplete).toBe(true)
    expect(e.progress.percent).toBe(100)
    expect(e.completedAt).toBeTruthy()
    const mine = await t.api('GET', '/api/me/enrollments', { token: learner })
    expect(mine.body.items[0].completedAt).toBeTruthy()
  })
})
