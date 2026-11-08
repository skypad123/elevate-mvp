import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let teacher: string
let teacherId: string
let agent: string
let courseId: string
let lessonA: string
let lessonB: string
let lessonC: string

beforeAll(async () => {
  t = await createTestApp()
  const signed = await t.signIn('builder@example.com', 'teach')
  teacher = signed.token as string
  teacherId = signed.body.user.id
  await t.db
    .insert(s.teacherProfiles)
    .values({ userId: teacherId, displayName: 'Builder', status: 'approved' })
  await t.grantRole('builder@example.com', 'teacher')
  await t.grantRole('reviewer@example.com', 'support_agent')
  agent = (await t.signIn('reviewer@example.com', 'support')).token as string
})
afterAll(async () => {
  await t.close()
})

const course = () => t.api('GET', `/api/teach/courses/${courseId}`, { token: teacher })

describe('course builder', () => {
  it('creates a draft course with a unique slug', async () => {
    const a = await t.api('POST', '/api/teach/courses', {
      token: teacher,
      body: { title: 'Sourdough from Scratch', category: 'food-drink' },
    })
    expect(a.status).toBe(200)
    expect(a.body.course.slug).toBe('sourdough-from-scratch')
    expect(a.body.course.status).toBe('draft')
    courseId = a.body.course.id
    const b = await t.api('POST', '/api/teach/courses', {
      token: teacher,
      body: { title: 'Sourdough from Scratch', category: 'food-drink' },
    })
    expect(b.body.course.slug).toBe('sourdough-from-scratch-2')
    const list = await t.api('GET', '/api/teach/courses', { token: teacher })
    expect(list.body.items).toHaveLength(2)
    expect(
      (
        await t.api('POST', '/api/teach/courses', {
          token: teacher,
          body: { title: 'x', category: 'nope' },
        })
      ).status,
    ).toBe(400)
  })

  it('builds lessons and artefacts, reorders, and sets a valid prerequisite graph', async () => {
    for (const title of ['Starter', 'Mixing', 'Baking']) {
      const r = await t.api('POST', `/api/teach/courses/${courseId}/lessons`, {
        token: teacher,
        body: { title },
      })
      expect(r.status).toBe(200)
    }
    let view = (await course()).body.course
    ;[lessonA, lessonB, lessonC] = view.lessons.map((l: { id: string }) => l.id)
    expect(view.lessons.map((l: { position: number }) => l.position)).toEqual([0, 1, 2])

    const reordered = await t.api('PUT', `/api/teach/courses/${courseId}/lessons/order`, {
      token: teacher,
      body: { ids: [lessonC, lessonA, lessonB] },
    })
    expect(reordered.body.course.lessons.map((l: { title: string }) => l.title)).toEqual([
      'Baking',
      'Starter',
      'Mixing',
    ])
    await t.api('PUT', `/api/teach/courses/${courseId}/lessons/order`, {
      token: teacher,
      body: { ids: [lessonA, lessonB, lessonC] },
    })
    expect(
      (
        await t.api('PUT', `/api/teach/courses/${courseId}/lessons/order`, {
          token: teacher,
          body: { ids: [lessonA, lessonB] },
        })
      ).status,
    ).toBe(400)

    const text = await t.api('POST', `/api/teach/lessons/${lessonA}/artefacts`, {
      token: teacher,
      body: { type: 'text', title: 'Why starters work' },
    })
    const artefactId = text.body.course.lessons[0].artefacts[0].id
    const content = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Wild yeast and bacteria.' }] },
      ],
    }
    const saved = await t.api('PATCH', `/api/teach/artefacts/${artefactId}`, {
      token: teacher,
      body: { contentJson: content },
    })
    expect(saved.body.course.lessons[0].artefacts[0].contentJson.content[0].content[0].text).toBe(
      'Wild yeast and bacteria.',
    )
    expect(
      (
        await t.api('PATCH', `/api/teach/artefacts/${artefactId}`, {
          token: teacher,
          body: { contentJson: { type: 'doc', content: [{ type: 'table' }] } },
        })
      ).status,
    ).toBe(400)

    const quiz = await t.api('POST', `/api/teach/lessons/${lessonC}/artefacts`, {
      token: teacher,
      body: { type: 'quiz', title: 'Final check' },
    })
    const quizArtefactId = quiz.body.course.lessons[2].artefacts[0].id
    const bad = await t.api('PUT', `/api/teach/artefacts/${quizArtefactId}/quiz`, {
      token: teacher,
      body: {
        passMarkPercent: 70,
        questions: [
          {
            id: 'q1',
            prompt: 'x',
            options: [
              { id: 'a', text: 'a', correct: true },
              { id: 'b', text: 'b', correct: true },
            ],
          },
        ],
      },
    })
    expect(bad.status).toBe(400)
    const good = await t.api('PUT', `/api/teach/artefacts/${quizArtefactId}/quiz`, {
      token: teacher,
      body: {
        passMarkPercent: 70,
        questions: [
          {
            id: 'q1',
            prompt: 'Which organism leavens sourdough?',
            options: [
              { id: 'a', text: 'Wild yeast', correct: true },
              { id: 'b', text: 'Baking powder', correct: false },
            ],
          },
        ],
      },
    })
    expect(good.status).toBe(200)
    expect(good.body.course.lessons[2].artefacts[0].quiz.questions).toHaveLength(1)

    // Baking requires Mixing, Mixing requires Starter
    expect(
      (
        await t.api('PUT', `/api/teach/lessons/${lessonB}/prerequisites`, {
          token: teacher,
          body: { prerequisiteIds: [lessonA] },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await t.api('PUT', `/api/teach/lessons/${lessonC}/prerequisites`, {
          token: teacher,
          body: { prerequisiteIds: [lessonB] },
        })
      ).status,
    ).toBe(200)
    // Starter requiring Baking would close a loop
    const cycle = await t.api('PUT', `/api/teach/lessons/${lessonA}/prerequisites`, {
      token: teacher,
      body: { prerequisiteIds: [lessonC] },
    })
    expect(cycle.status).toBe(422)
    expect(cycle.body.error.code).toBe('prerequisite_cycle')
    view = (await course()).body.course
    expect(view.lessons[2].prerequisiteIds).toEqual([lessonB])
  })

  it('refuses submission until the checklist passes, then locks editing while under review', async () => {
    const early = await t.api('POST', `/api/teach/courses/${courseId}/submit`, { token: teacher })
    expect(early.status).toBe(422)
    const codes = early.body.error.details.map((p: { code: string }) => p.code)
    expect(codes).toEqual(
      expect.arrayContaining(['summary', 'description', 'thumbnail', 'stripe', 'empty_lesson']),
    )

    // fix: summary, description, price, thumbnail, content for lesson B, stripe enabled
    const upload = await t.api('POST', '/api/media/uploads', {
      token: teacher,
      body: { kind: 'image', filename: 'cover.png', mimeType: 'image/png', sizeBytes: 10 },
    })
    const row = await t.db.query.mediaAssets.findFirst({
      where: eq(s.mediaAssets.id, upload.body.asset.id),
    })
    await t.storage.put(row?.storageKey as string, new Uint8Array([1]), 'image/png')
    await t.api('POST', `/api/media/assets/${upload.body.asset.id}/complete`, { token: teacher })
    const patched = await t.api('PATCH', `/api/teach/courses/${courseId}`, {
      token: teacher,
      body: {
        summary:
          'Build a starter, mix and fold, and bake a loaf with a real ear in a humid kitchen.',
        descriptionJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'A full description of the course.' }],
            },
          ],
        },
        priceCents: 8900,
        thumbnailMediaId: upload.body.asset.id,
      },
    })
    expect(patched.status).toBe(200)
    expect(patched.body.course.thumbnail.url).toContain('/api/files/public/')
    const textB = await t.api('POST', `/api/teach/lessons/${lessonB}/artefacts`, {
      token: teacher,
      body: { type: 'text', title: 'Folding' },
    })
    const bId = textB.body.course.lessons[1].artefacts[0].id
    await t.api('PATCH', `/api/teach/artefacts/${bId}`, {
      token: teacher,
      body: {
        contentJson: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Four sets of folds.' }] },
          ],
        },
      },
    })
    await t.db
      .update(s.teacherProfiles)
      .set({ stripeChargesEnabled: true, stripeAccountId: 'acct_test' })
      .where(eq(s.teacherProfiles.userId, teacherId))

    const ready = (await course()).body.course
    expect(ready.checklist.ok).toBe(true)
    const submitted = await t.api('POST', `/api/teach/courses/${courseId}/submit`, {
      token: teacher,
    })
    expect(submitted.status).toBe(200)
    expect(submitted.body.course.status).toBe('pending_review')

    const locked = await t.api('PATCH', `/api/teach/courses/${courseId}`, {
      token: teacher,
      body: { title: 'Changed' },
    })
    expect(locked.status).toBe(409)
    expect(
      (await t.api('DELETE', `/api/teach/courses/${courseId}`, { token: teacher })).status,
    ).toBe(409)
  })

  it('Support sees the queue, approval is the only path to live, rejection returns it to the teacher', async () => {
    const queue = await t.api('GET', '/api/support/review-queue', { token: agent })
    expect(queue.status).toBe(200)
    expect(queue.body.items.map((c: { id: string }) => c.id)).toContain(courseId)
    expect((await t.api('GET', '/api/support/review-queue', { token: teacher })).status).toBe(403)

    const preview = await t.api('GET', `/api/support/courses/${courseId}`, { token: agent })
    expect(preview.body.course.lessons).toHaveLength(3)
    expect(preview.body.course.teacher.email).toBe('builder@example.com')

    const rejected = await t.api('POST', `/api/support/courses/${courseId}/reject`, {
      token: agent,
      body: { reason: 'Please add a video to the first lesson.' },
    })
    expect(rejected.body.course.status).toBe('rejected')
    expect(rejected.body.course.rejectionReason).toContain('video')
    expect(t.mailer.last()?.subject).toContain('Changes requested')

    // teacher can edit again and resubmit
    expect(
      (
        await t.api('PATCH', `/api/teach/courses/${courseId}`, {
          token: teacher,
          body: { title: 'Sourdough from Scratch, Second Pass' },
        })
      ).status,
    ).toBe(200)
    expect(
      (await t.api('POST', `/api/teach/courses/${courseId}/submit`, { token: teacher })).body.course
        .status,
    ).toBe('pending_review')

    expect(
      (await t.api('POST', `/api/support/courses/${courseId}/approve`, { token: teacher })).status,
    ).toBe(403)
    const approved = await t.api('POST', `/api/support/courses/${courseId}/approve`, {
      token: agent,
    })
    expect(approved.status).toBe(200)
    expect(approved.body.course.status).toBe('live')
    expect(approved.body.course.publishedAt).toBeTruthy()
    expect(t.mailer.last()?.subject).toContain('is live')
    const audit = await t.db.query.auditLog.findMany({ where: eq(s.auditLog.entityId, courseId) })
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['course.submit', 'course.reject', 'course.approve']),
    )
    expect(
      (await t.api('POST', `/api/support/courses/${courseId}/approve`, { token: agent })).status,
    ).toBe(409)
  })
})
