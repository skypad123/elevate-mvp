import { schema as s } from '@elevate/db'
import { eq, isNotNull } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Goal 11 and CUJ 3: a writer's edits to a live course reach learners only after an owner or
 * manager approves them. Each test builds its own live course with an enrolled learner.
 *
 * The fixture course has two lessons: "First lesson" with a text artefact, and "Second lesson"
 * with a quiz artefact.
 */
let t: TestApp
let profileId: string
let owner: string
let writer: string
let learner: string

type Lesson = {
  id: string
  sourceId: string | null
  title: string
  prerequisiteIds: string[]
  artefacts: Array<{ id: string; sourceId: string | null; title: string; type: string }>
}
type Course = {
  id: string
  viewing: 'live' | 'draft'
  changeSet: { id: string; openedBy: string | null } | null
  lessons: Lesson[]
}
type Conflict = {
  kind: string
  item: string | null
  id: string
  liveId: string | null
  draftId: string | null
  droppedChildren: number
  seen: string
  resolution: string | null
}

const teach = (path: string) => `/api/teach/profiles/${profileId}${path}`
const titles = (course: { lessons: Array<{ title: string }> }) => course.lessons.map((l) => l.title)

async function liveCourse() {
  const course = await t.createCourse(profileId, { status: 'live' })
  const enrollment = await t.enrol('learner@example.com', course.courseId)
  return { ...course, enrollmentId: enrollment.id }
}

const tree = async (token: string, courseId: string, draft = false): Promise<Course> =>
  (await t.api('GET', teach(`/courses/${courseId}${draft ? '?draft=1' : ''}`), { token })).body
    .course

const learnerView = async (enrollmentId: string) =>
  (await t.api('GET', `/api/me/enrollments/${enrollmentId}`, { token: learner })).body.enrollment

const changeSetOf = async (courseId: string, token = owner) =>
  (await t.api('GET', teach(`/courses/${courseId}/change-set`), { token })).body.changeSet

const approve = (courseId: string, token = owner) =>
  t.api('POST', teach(`/courses/${courseId}/change-set/approve`), { token })

const resolve = (
  courseId: string,
  choices: Array<{ kind: string; id: string; keep: 'live' | 'draft'; seen: string }>,
) =>
  t.api('POST', teach(`/courses/${courseId}/change-set/resolve`), {
    token: owner,
    body: { choices },
  })

/** How many draft rows the course has left, in all four tables. */
async function draftCount(courseId: string): Promise<number> {
  const lessons = await t.db.select().from(s.lessons).where(eq(s.lessons.courseId, courseId))
  const drafts = lessons.filter((l) => l.changeSetId !== null)
  const artefacts = await t.db.select().from(s.artefacts).where(isNotNull(s.artefacts.changeSetId))
  const quizzes = await t.db.select().from(s.quizzes).where(isNotNull(s.quizzes.changeSetId))
  const links = await t.db
    .select()
    .from(s.lessonPrerequisites)
    .where(isNotNull(s.lessonPrerequisites.changeSetId))
  const lessonIds = new Set(lessons.map((l) => l.id))
  const mine = artefacts.filter((a) => lessonIds.has(a.lessonId))
  const artefactIds = new Set(mine.map((a) => a.id))
  return (
    drafts.length +
    mine.length +
    quizzes.filter((q) => artefactIds.has(q.artefactId)).length +
    links.filter((l) => lessonIds.has(l.lessonId)).length
  )
}

const question = (id: string, prompt: string) => ({
  id,
  prompt,
  options: [
    { id: 'a', text: 'Yes', correct: true },
    { id: 'b', text: 'No', correct: false },
  ],
})

beforeAll(async () => {
  t = await createTestApp()
  profileId = (await t.createProfile('owner@example.com', { payable: true })).profile.id
  await t.addMember(profileId, 'writer@example.com', 'writer')
  owner = (await t.signIn('owner@example.com', 'teach')).token as string
  writer = (await t.signIn('writer@example.com', 'teach')).token as string
  learner = (await t.signIn('learner@example.com')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('a writer edits a live course (CUJ 3)', () => {
  it('learners see nothing until an owner approves, and then see all of it', async () => {
    const c = await liveCourse()

    // The writer's first edit names the live lesson. It opens a change set and answers with the
    // draft tree, whose rows have their own IDs.
    const first = await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: 'First lesson, improved' },
    })
    expect(first.status).toBe(200)
    const draft = first.body.course as Course
    expect(draft.viewing).toBe('draft')
    expect(draft.changeSet).not.toBeNull()
    const draftA = draft.lessons.find((l) => l.sourceId === c.lessonA) as Lesson
    expect(draftA.id).not.toBe(c.lessonA)
    expect(draftA.title).toBe('First lesson, improved')
    expect(draftA.artefacts.map((a) => a.sourceId)).toEqual([c.textArtefactId])

    const added = await t.api('POST', teach(`/lessons/${draftA.id}/artefacts`), {
      token: writer,
      body: { type: 'text', title: 'Extra reading' },
    })
    expect(added.status).toBe(200)
    const extra = (added.body.course as Course).lessons
      .find((l) => l.id === draftA.id)
      ?.artefacts.find((a) => a.title === 'Extra reading')
    expect(extra?.sourceId).toBeNull()

    // ── learners see no change, anywhere ──
    const before = await learnerView(c.enrollmentId)
    expect(titles(before)).toEqual(['First lesson', 'Second lesson'])
    expect(before.lessons[0].artefacts).toHaveLength(1)
    const lesson = await t.api(
      'GET',
      `/api/me/enrollments/${c.enrollmentId}/lessons/${c.lessonA}`,
      {
        token: learner,
      },
    )
    expect(lesson.body.lesson.artefacts.map((a: { title: string }) => a.title)).toEqual([
      'Read this',
    ])
    const page = await t.api('GET', `/api/catalog/courses/${c.slug}`)
    expect(titles(page.body.course)).toEqual(['First lesson', 'Second lesson'])
    expect(page.body.course).toMatchObject({ lessonCount: 2, artefactCount: 2 })
    const listed = await t.api('GET', '/api/catalog/courses?limit=50')
    expect(listed.body.items.find((i: { id: string }) => i.id === c.courseId).lessonCount).toBe(2)
    const mine = await t.api('GET', '/api/me/enrollments', { token: learner })
    expect(
      mine.body.items.find((i: { id: string }) => i.id === c.enrollmentId).progress.totalArtefacts,
    ).toBe(2)

    // ── the owner sees one pending change set, and the live course as it was ──
    const live = await tree(owner, c.courseId)
    expect(live.viewing).toBe('live')
    expect(titles(live)).toEqual(['First lesson', 'Second lesson'])
    expect(live.changeSet).toMatchObject({ openedBy: 'writer@example.com' })
    const list = await t.api('GET', teach('/courses'), { token: owner })
    expect(list.body.items.find((i: { id: string }) => i.id === c.courseId).pendingChanges).toBe(
      true,
    )
    const notice = t.mailer.sent.filter((m) => m.to === 'owner@example.com').at(-1)
    expect(notice?.subject).toBe('writer@example.com has changes waiting on "Fixture course"')
    expect(notice?.text).toContain(`/p/${profileId}/courses/${c.courseId}/changes`)
    const pending = await changeSetOf(c.courseId)
    expect(pending).toMatchObject({
      status: 'open',
      openedBy: { email: 'writer@example.com' },
      conflicts: [],
    })
    expect(pending.items).toEqual([
      {
        kind: 'lesson',
        liveId: c.lessonA,
        draftId: draftA.id,
        change: 'edited',
        title: 'First lesson, improved',
      },
      {
        kind: 'artefact',
        liveId: null,
        draftId: extra?.id,
        change: 'added',
        title: 'Extra reading',
      },
    ])
    // the draft tree is there for the review screen
    expect(titles(await tree(owner, c.courseId, true))).toEqual([
      'First lesson, improved',
      'Second lesson',
    ])

    // ── approval ──
    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const after = approved.body.course as Course
    expect(after.viewing).toBe('live')
    expect(after.changeSet).toBeNull()
    // the live lesson kept its ID and has the new title; the new artefact kept its own ID
    const lessonA = after.lessons.find((l) => l.id === c.lessonA) as Lesson
    expect(lessonA.title).toBe('First lesson, improved')
    expect(lessonA.artefacts.map((a) => a.id)).toEqual([c.textArtefactId, extra?.id])
    expect(after.lessons.map((l) => l.sourceId)).toEqual([null, null])

    const seen = await learnerView(c.enrollmentId)
    expect(titles(seen)).toEqual(['First lesson, improved', 'Second lesson'])
    expect(seen.lessons[0].artefacts.map((a: { title: string }) => a.title)).toEqual([
      'Read this',
      'Extra reading',
    ])

    expect(await draftCount(c.courseId)).toBe(0)
    const stored = await t.db.query.courseChangeSets.findFirst({ where: { courseId: c.courseId } })
    expect(stored?.status).toBe('approved')
    expect(stored?.decidedBy).not.toBeNull()
    expect(t.mailer.sent.filter((m) => m.to === 'writer@example.com').at(-1)?.subject).toBe(
      'Your changes to "Fixture course" are live',
    )
    const audit = await t.db.query.auditLog.findMany({
      where: { entityId: c.courseId, profileId },
      orderBy: { createdAt: 'asc' },
    })
    expect(audit.map((a) => a.action)).toEqual(['change_set.open', 'change_set.approve'])
  })

  it("keeps a learner's progress on an artefact the writer edited", async () => {
    const c = await liveCourse()
    const done = await t.api(
      'POST',
      `/api/me/enrollments/${c.enrollmentId}/artefacts/${c.textArtefactId}/progress`,
      { token: learner, body: { status: 'completed' } },
    )
    expect(done.status).toBe(200)
    const edit = await t.api('PATCH', teach(`/artefacts/${c.textArtefactId}`), {
      token: writer,
      body: { title: 'Read this, rewritten' },
    })
    expect(edit.status).toBe(200)
    expect((await approve(c.courseId)).status).toBe(200)

    const view = await learnerView(c.enrollmentId)
    const artefact = view.lessons[0].artefacts[0]
    expect(artefact).toMatchObject({ id: c.textArtefactId, title: 'Read this, rewritten' })
    expect(artefact.progress.status).toBe('completed')
  })

  it('applies a quiz edit to the same quiz row, with attempts still attached', async () => {
    const c = await liveCourse()
    // the owner sets the quiz before the writer starts, and a learner begins an attempt
    const set = await t.api('PUT', teach(`/artefacts/${c.quizArtefactId}/quiz`), {
      token: owner,
      body: { passMarkPercent: 50, questions: [question('q1', 'Is this live?')] },
    })
    expect(set.status).toBe(200)
    const attempt = await t.api(
      'POST',
      `/api/me/enrollments/${c.enrollmentId}/quizzes/${c.quizId}/attempts`,
      { token: learner },
    )
    expect(attempt.status).toBe(200)

    const edit = await t.api('PUT', teach(`/artefacts/${c.quizArtefactId}/quiz`), {
      token: writer,
      body: {
        passMarkPercent: 50,
        questions: [question('q1', 'Is this live?'), question('q2', 'A second question?')],
      },
    })
    expect(edit.status).toBe(200)
    // the learner still gets the one-question quiz
    const during = await t.api(
      'GET',
      `/api/me/enrollments/${c.enrollmentId}/lessons/${c.lessonB}`,
      { token: learner },
    )
    expect(during.body.lesson.artefacts[0].quiz.questions).toHaveLength(1)
    // saving a quiz also sets its artefact's duration from the number of questions
    expect((await changeSetOf(c.courseId)).items).toMatchObject([
      { kind: 'artefact', liveId: c.quizArtefactId, change: 'edited' },
      { kind: 'quiz', liveId: c.quizArtefactId, change: 'edited' },
    ])

    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const quiz = await t.db.query.quizzes.findFirst({ where: { artefactId: c.quizArtefactId } })
    expect(quiz?.id).toBe(c.quizId)
    expect(quiz?.questionsJson).toHaveLength(2)
    const attempts = await t.db.query.quizAttempts.findMany({ where: { quizId: c.quizId } })
    expect(attempts.map((a) => a.id)).toEqual([attempt.body.attempt.id])
    const afterwards = await t.api(
      'GET',
      `/api/me/enrollments/${c.enrollmentId}/lessons/${c.lessonB}`,
      { token: learner },
    )
    expect(afterwards.body.lesson.artefacts[0]).toMatchObject({ quizId: c.quizId })
    expect(afterwards.body.lesson.artefacts[0].quiz.questions).toHaveLength(2)
  })

  it('applies prerequisites added, removed, and between two new lessons', async () => {
    const c = await liveCourse()
    // live: the second lesson needs the first
    const gate = await t.api('PUT', teach(`/lessons/${c.lessonB}/prerequisites`), {
      token: owner,
      body: { prerequisiteIds: [c.lessonA] },
    })
    expect(gate.status).toBe(200)

    // the writer removes that link, then makes the first lesson need the second: live IDs
    // throughout, which stand for their draft copies
    const cleared = await t.api('PUT', teach(`/lessons/${c.lessonB}/prerequisites`), {
      token: writer,
      body: { prerequisiteIds: [] },
    })
    expect(cleared.status).toBe(200)
    const flipped = await t.api('PUT', teach(`/lessons/${c.lessonA}/prerequisites`), {
      token: writer,
      body: { prerequisiteIds: [c.lessonB] },
    })
    expect(flipped.status).toBe(200)
    // two new lessons: the fourth needs the third, the third needs the first
    await t.api('POST', teach(`/courses/${c.courseId}/lessons`), {
      token: writer,
      body: { title: 'Third lesson' },
    })
    const grown = await t.api('POST', teach(`/courses/${c.courseId}/lessons`), {
      token: writer,
      body: { title: 'Fourth lesson' },
    })
    const lessons = (grown.body.course as Course).lessons
    const third = lessons.find((l) => l.title === 'Third lesson') as Lesson
    const fourth = lessons.find((l) => l.title === 'Fourth lesson') as Lesson
    const draftA = lessons.find((l) => l.sourceId === c.lessonA) as Lesson
    expect(
      (
        await t.api('PUT', teach(`/lessons/${fourth.id}/prerequisites`), {
          token: writer,
          body: { prerequisiteIds: [third.id] },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await t.api('PUT', teach(`/lessons/${third.id}/prerequisites`), {
          token: writer,
          body: { prerequisiteIds: [draftA.id] },
        })
      ).status,
    ).toBe(200)
    // a loop is refused inside the draft, as it is on a live course
    const loop = await t.api('PUT', teach(`/lessons/${c.lessonB}/prerequisites`), {
      token: writer,
      body: { prerequisiteIds: [fourth.id] },
    })
    expect(loop.status).toBe(422)

    // the learner's course still has the old gate
    const during = await learnerView(c.enrollmentId)
    expect(during.lessons.map((l: { status: string }) => l.status)).toEqual(['available', 'locked'])

    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    const prerequisites = Object.fromEntries(live.lessons.map((l) => [l.title, l.prerequisiteIds]))
    expect(prerequisites).toEqual({
      'First lesson': [c.lessonB],
      'Second lesson': [],
      'Third lesson': [c.lessonA],
      'Fourth lesson': [third.id],
    })
    expect(await draftCount(c.courseId)).toBe(0)
  })

  it('removes what the writer removed, and not what they added and then removed', async () => {
    const c = await liveCourse()
    const added = await t.api('POST', teach(`/lessons/${c.lessonA}/artefacts`), {
      token: writer,
      body: { type: 'text', title: 'Second thoughts' },
    })
    const mistake = (added.body.course as Course).lessons[0]?.artefacts.find(
      (a) => a.title === 'Second thoughts',
    )
    const undone = await t.api('DELETE', teach(`/artefacts/${mistake?.id}`), { token: writer })
    expect(undone.status).toBe(200)
    // a removed copy leaves the draft tree, and its live row is still there for learners
    const removed = await t.api('DELETE', teach(`/lessons/${c.lessonB}`), { token: writer })
    expect(titles(removed.body.course)).toEqual(['First lesson'])
    expect(titles(await learnerView(c.enrollmentId))).toEqual(['First lesson', 'Second lesson'])
    // the removed lesson cannot be edited any more, by either ID
    const stale = await t.api('PATCH', teach(`/lessons/${c.lessonB}`), {
      token: writer,
      body: { title: 'Too late' },
    })
    expect(stale.status).toBe(404)

    expect((await changeSetOf(c.courseId)).items).toMatchObject([
      { kind: 'lesson', liveId: c.lessonB, change: 'removed' },
    ])
    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    expect(titles(live)).toEqual(['First lesson'])
    expect(live.lessons[0]?.artefacts.map((a) => a.title)).toEqual(['Read this'])
    expect(await t.db.query.quizzes.findFirst({ where: { id: c.quizId } })).toBe(undefined)
    expect(titles(await learnerView(c.enrollmentId))).toEqual(['First lesson'])
  })
})

describe('which rows an edit reaches', () => {
  it('sends a writer to the draft whichever ID they use, and never lets an owner reach a draft', async () => {
    const c = await liveCourse()
    const opened = await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: 'Draft title' },
    })
    const draftA = (opened.body.course as Course).lessons.find(
      (l) => l.sourceId === c.lessonA,
    ) as Lesson
    // a stale live ID still edits the draft
    const stale = await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: 'Draft title, again' },
    })
    expect(stale.status).toBe(200)
    expect((await tree(writer, c.courseId, true)).lessons[0]?.title).toBe('Draft title, again')
    expect((await tree(writer, c.courseId)).lessons[0]?.title).toBe('First lesson')
    // a second writer's edits join the same change set
    await t.addMember(profileId, 'writer2@example.com', 'writer')
    const writer2 = (await t.signIn('writer2@example.com', 'teach')).token as string
    const joined = await t.api('PATCH', teach(`/lessons/${c.lessonB}`), {
      token: writer2,
      body: { title: 'Second lesson, by another writer' },
    })
    expect((joined.body.course as Course).changeSet?.id).toBe(
      (opened.body.course as Course).changeSet?.id,
    )

    // an owner edits live rows; a draft's ID finds nothing for them
    const draftArtefact = draftA.artefacts[0]?.id
    const calls: Array<[string, string, unknown?]> = [
      ['PATCH', `/lessons/${draftA.id}`, { title: 'Reaching into the draft' }],
      ['DELETE', `/lessons/${draftA.id}`],
      ['PUT', `/lessons/${draftA.id}/prerequisites`, { prerequisiteIds: [] }],
      ['POST', `/lessons/${draftA.id}/artefacts`, { type: 'text', title: 'Into the draft' }],
      ['PATCH', `/artefacts/${draftArtefact}`, { title: 'Reaching into the draft' }],
      ['DELETE', `/artefacts/${draftArtefact}`],
    ]
    for (const [method, path, body] of calls) {
      const res = await t.api(method, teach(path), { token: owner, body })
      expect(res.status, `${method} ${path}`).toBe(404)
    }
    expect((await tree(writer, c.courseId, true)).lessons[0]?.title).toBe('Draft title, again')
  })

  it('answers 404 to a learner who names a draft row', async () => {
    const c = await liveCourse()
    await t.api('PUT', teach(`/artefacts/${c.quizArtefactId}/quiz`), {
      token: owner,
      body: { passMarkPercent: 50, questions: [question('q1', 'Is this live?')] },
    })
    const opened = await t.api('POST', teach(`/lessons/${c.lessonA}/artefacts`), {
      token: writer,
      body: { type: 'text', title: 'Not live yet' },
    })
    const draft = opened.body.course as Course
    const draftLesson = draft.lessons[0] as Lesson
    const draftQuiz = await t.db.query.quizzes.findFirst({ where: { sourceId: c.quizId } })
    expect(draftQuiz).toBeDefined()
    const base = `/api/me/enrollments/${c.enrollmentId}`
    const calls: Array<[string, string, unknown?]> = [
      ['GET', `${base}/lessons/${draftLesson.id}`],
      [
        'POST',
        `${base}/artefacts/${draftLesson.artefacts[0]?.id}/progress`,
        { positionSeconds: 5 },
      ],
      [
        'POST',
        `${base}/artefacts/${draftLesson.artefacts[1]?.id}/progress`,
        { status: 'completed' },
      ],
      ['POST', `${base}/quizzes/${draftQuiz?.id}/attempts`],
    ]
    for (const [method, path, body] of calls) {
      const res = await t.api(method, path, { token: learner, body })
      expect(res.status, `${method} ${path}`).toBe(404)
    }
    expect(
      await t.db.query.artefactProgress.findMany({ where: { enrollmentId: c.enrollmentId } }),
    ).toEqual([])
  })

  it('leaves My Learning and the checkout quote as they were while a change set is open', async () => {
    const c = await liveCourse()
    const myLearning = async () =>
      (await t.api('GET', '/api/me/enrollments', { token: learner })).body.items.find(
        (i: { id: string }) => i.id === c.enrollmentId,
      )
    const quote = async () =>
      (
        await t.api('POST', '/api/checkout/quote', {
          token: learner,
          body: { courseId: c.courseId },
        })
      ).body
    const before = { learning: await myLearning(), quote: await quote() }
    expect(before.learning.progress).toMatchObject({ totalArtefacts: 2, percent: 0 })

    await t.api('POST', teach(`/courses/${c.courseId}/lessons`), {
      token: writer,
      body: { title: 'A lesson learners do not have yet' },
    })
    await t.api('POST', teach(`/lessons/${c.lessonA}/artefacts`), {
      token: writer,
      body: { type: 'text', title: 'More to read' },
    })
    expect(await draftCount(c.courseId)).toBeGreaterThan(0)
    expect({ learning: await myLearning(), quote: await quote() }).toEqual(before)
  })

  it('keeps a live course details, price and approval away from a writer', async () => {
    const c = await liveCourse()
    await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: 'A change to approve' },
    })
    const calls: Array<[string, string, unknown?]> = [
      ['PATCH', `/courses/${c.courseId}`, { title: 'A new course title' }],
      ['PUT', `/courses/${c.courseId}/price`, { priceCents: 1 }],
      ['POST', `/courses/${c.courseId}/change-set/approve`],
      ['POST', `/courses/${c.courseId}/change-set/discard`],
      [
        'POST',
        `/courses/${c.courseId}/change-set/resolve`,
        {
          choices: [{ kind: 'edited', id: c.lessonA, keep: 'draft', seen: 'x' }],
        },
      ],
    ]
    for (const [method, path, body] of calls) {
      const res = await t.api(method, teach(path), { token: writer, body })
      expect(res.status, `${method} ${path}`).toBe(403)
    }
    // the writer can see what is waiting
    expect((await changeSetOf(c.courseId, writer)).items).toHaveLength(1)
  })

  it('edits a draft course directly: no change set is involved', async () => {
    const course = await t.createCourse(profileId, { status: 'draft' })
    const edit = await t.api('PATCH', teach(`/lessons/${course.lessonA}`), {
      token: writer,
      body: { title: 'Edited in place' },
    })
    expect(edit.status).toBe(200)
    expect(edit.body.course).toMatchObject({ viewing: 'live', changeSet: null })
    expect((edit.body.course as Course).lessons[0]).toMatchObject({
      id: course.lessonA,
      title: 'Edited in place',
    })
    expect(
      await t.db.query.courseChangeSets.findFirst({ where: { courseId: course.courseId } }),
    ).toBe(undefined)
    // with nothing open there is nothing to approve, and the course is not "not found"
    expect(await changeSetOf(course.courseId)).toBeNull()
    const nothing = await approve(course.courseId)
    expect(nothing.status).toBe(409)
    expect(nothing.body.error.code).toBe('no_open_change_set')
  })
})

describe('conflicts with edits made to the live course', () => {
  /** A writer edits the first lesson and adds to the second; the owner then edits one and deletes the other. */
  async function clash() {
    const c = await liveCourse()
    const opened = await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: "The writer's title" },
    })
    const draft = opened.body.course as Course
    const draftA = draft.lessons.find((l) => l.sourceId === c.lessonA) as Lesson
    const draftB = draft.lessons.find((l) => l.sourceId === c.lessonB) as Lesson
    await t.api('POST', teach(`/lessons/${draftB.id}/artefacts`), {
      token: writer,
      body: { type: 'text', title: "The writer's addition" },
    })
    const edited = await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: owner,
      body: { title: "The owner's title" },
    })
    expect(edited.status).toBe(200)
    expect((await t.api('DELETE', teach(`/lessons/${c.lessonB}`), { token: owner })).status).toBe(
      200,
    )
    return { ...c, draftA, draftB }
  }

  const byKind = (conflicts: Conflict[]) =>
    Object.fromEntries(conflicts.map((conflict) => [conflict.kind, conflict]))

  it('reports a live edit and a live deletion, changes nothing, and applies the choices made', async () => {
    const c = await clash()
    const refused = await approve(c.courseId)
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('change_set_conflict')
    const conflicts = refused.body.error.details.conflicts as Conflict[]
    // the deleted lesson is one conflict: the quiz artefact that went with it is not listed apart
    expect(conflicts).toHaveLength(2)
    const { edited, deleted } = byKind(conflicts)
    expect(edited).toMatchObject({
      item: 'lesson',
      id: c.draftA.id,
      liveId: c.lessonA,
      draftId: c.draftA.id,
      droppedChildren: 0,
      resolution: null,
    })
    // keeping the owner's deletion would drop the one artefact the writer added under it
    expect(deleted).toMatchObject({
      item: 'lesson',
      id: c.draftB.id,
      liveId: null,
      draftId: c.draftB.id,
      droppedChildren: 1,
      resolution: null,
    })
    // nothing was applied
    expect(titles(await tree(owner, c.courseId))).toEqual(["The owner's title"])
    expect(await draftCount(c.courseId)).toBeGreaterThan(0)
    expect((await changeSetOf(c.courseId)).conflicts).toEqual(conflicts)

    // a choice made against a state that is not the current one is refused
    const outdated = await resolve(c.courseId, [
      { kind: 'edited', id: c.draftA.id, keep: 'draft', seen: '2020-01-01T00:00:00.000Z' },
    ])
    expect(outdated.status).toBe(409)
    expect(outdated.body.error.code).toBe('change_set_conflict')

    // resolving one of two is not enough
    const one = await resolve(c.courseId, [
      { kind: 'edited', id: c.draftA.id, keep: 'draft', seen: edited?.seen as string },
    ])
    expect(one.status).toBe(200)
    expect(byKind(one.body.changeSet.conflicts).edited?.resolution).toBe('draft')
    expect((await approve(c.courseId)).status).toBe(409)

    const both = await resolve(c.courseId, [
      { kind: 'deleted', id: c.draftB.id, keep: 'live', seen: deleted?.seen as string },
    ])
    expect(both.body.changeSet.conflicts.map((x: Conflict) => x.resolution).sort()).toEqual([
      'draft',
      'live',
    ])

    // a live edit made after resolving is a new conflict
    await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: owner,
      body: { title: "The owner's second title" },
    })
    const again = await approve(c.courseId)
    expect(again.status).toBe(409)
    const now = byKind(again.body.error.details.conflicts)
    expect(now.edited?.resolution).toBeNull()
    expect(now.edited?.seen).not.toBe(edited?.seen)
    expect(now.deleted?.resolution).toBe('live')

    // this time the owner keeps the live lesson
    await resolve(c.courseId, [
      { kind: 'edited', id: c.draftA.id, keep: 'live', seen: now.edited?.seen as string },
    ])
    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    // the live title stayed, the deletion stood, and the writer's addition went with it
    expect(titles(live)).toEqual(["The owner's second title"])
    expect(live.lessons[0]?.id).toBe(c.lessonA)
    expect(await draftCount(c.courseId)).toBe(0)
    expect(
      await t.db.query.artefacts.findFirst({ where: { title: "The writer's addition" } }),
    ).toBe(undefined)
  })

  it('brings a deleted lesson back as a new one when the draft is kept', async () => {
    const c = await clash()
    const conflicts = (await changeSetOf(c.courseId)).conflicts as Conflict[]
    const res = await resolve(
      c.courseId,
      conflicts.map((x) => ({ kind: x.kind, id: x.id, keep: 'draft' as const, seen: x.seen })),
    )
    expect(res.status).toBe(200)
    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    expect(titles(live)).toEqual(["The writer's title", 'Second lesson'])
    // the first lesson kept its ID; the second is a new row, with the copy of its quiz artefact
    // and the writer's addition under it
    expect(live.lessons[0]?.id).toBe(c.lessonA)
    const second = live.lessons[1] as Lesson
    expect(second.id).toBe(c.draftB.id)
    expect(second.artefacts.map((a) => a.title)).toEqual([
      'Check yourself',
      "The writer's addition",
    ])
    const quizArtefact = second.artefacts[0]
    expect(
      await t.db.query.quizzes.findFirst({ where: { artefactId: quizArtefact?.id } }),
    ).toBeDefined()
    expect(await draftCount(c.courseId)).toBe(0)
    expect(titles(await learnerView(c.enrollmentId))).toEqual([
      "The writer's title",
      'Second lesson',
    ])
  })

  it('treats artefacts the same way: one edited and one deleted on the live course', async () => {
    const c = await liveCourse()
    for (const [id, title] of [
      [c.textArtefactId, "The writer's text"],
      [c.quizArtefactId, "The writer's quiz"],
    ]) {
      const res = await t.api('PATCH', teach(`/artefacts/${id}`), {
        token: writer,
        body: { title },
      })
      expect(res.status).toBe(200)
    }
    await t.api('PATCH', teach(`/artefacts/${c.textArtefactId}`), {
      token: owner,
      body: { title: "The owner's text" },
    })
    await t.api('DELETE', teach(`/artefacts/${c.quizArtefactId}`), { token: owner })

    const conflicts = (await changeSetOf(c.courseId)).conflicts as Conflict[]
    // the quiz that went with the deleted artefact is not a conflict of its own
    expect(conflicts).toMatchObject([
      { kind: 'edited', item: 'artefact', liveId: c.textArtefactId },
      { kind: 'deleted', item: 'artefact', liveId: null },
    ])
    await resolve(
      c.courseId,
      conflicts.map((x) => ({ kind: x.kind, id: x.id, keep: 'draft' as const, seen: x.seen })),
    )
    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const [first, second] = (approved.body.course as Course).lessons
    expect(first?.artefacts).toMatchObject([{ id: c.textArtefactId, title: "The writer's text" }])
    // the deleted artefact is back as a new row, with its quiz
    expect(second?.artefacts).toMatchObject([{ title: "The writer's quiz", type: 'quiz' }])
    const back = second?.artefacts[0]?.id as string
    expect(back).not.toBe(c.quizArtefactId)
    expect(await t.db.query.quizzes.findFirst({ where: { artefactId: back } })).toBeDefined()
    expect(await draftCount(c.courseId)).toBe(0)
  })

  it('asks before removing a lesson whose content the owner has edited since', async () => {
    const c = await liveCourse()
    await t.api('DELETE', teach(`/lessons/${c.lessonB}`), { token: writer })
    await t.api('PATCH', teach(`/artefacts/${c.quizArtefactId}`), {
      token: owner,
      body: { title: 'Still wanted' },
    })
    const conflicts = (await changeSetOf(c.courseId)).conflicts as Conflict[]
    expect(conflicts).toMatchObject([{ kind: 'edited', item: 'lesson', liveId: c.lessonB }])
    expect((await approve(c.courseId)).status).toBe(409)

    // keeping the live lesson cancels the removal
    await resolve(c.courseId, [
      {
        kind: 'edited',
        id: conflicts[0]?.id as string,
        keep: 'live',
        seen: conflicts[0]?.seen as string,
      },
    ])
    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    expect(titles(live)).toEqual(['First lesson', 'Second lesson'])
    expect(live.lessons[1]?.artefacts).toMatchObject([
      { id: c.quizArtefactId, title: 'Still wanted' },
    ])
  })

  it('does not count a live save that changed nothing, or a lesson the owner added', async () => {
    const c = await liveCourse()
    await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: "The writer's title" },
    })
    // the owner saves the second lesson without changing it, and adds a third that needs the first
    const same = await t.api('PATCH', teach(`/lessons/${c.lessonB}`), {
      token: owner,
      body: { title: 'Second lesson' },
    })
    expect(same.status).toBe(200)
    const added = await t.api('POST', teach(`/courses/${c.courseId}/lessons`), {
      token: owner,
      body: { title: "The owner's new lesson" },
    })
    const mine = (added.body.course as Course).lessons.find(
      (l) => l.title === "The owner's new lesson",
    ) as Lesson
    await t.api('PUT', teach(`/lessons/${mine.id}/prerequisites`), {
      token: owner,
      body: { prerequisiteIds: [c.lessonA] },
    })
    expect((await changeSetOf(c.courseId)).conflicts).toEqual([])

    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    expect(titles(live)).toEqual(["The writer's title", 'Second lesson', "The owner's new lesson"])
    expect(live.lessons[2]).toMatchObject({ id: mine.id, prerequisiteIds: [c.lessonA] })
  })

  it('does not count an owner edit or deletion of something the writer left alone', async () => {
    const c = await liveCourse()
    // the writer renames the first lesson only
    await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: "The writer's title" },
    })
    // the owner renames the second lesson and its quiz artefact, changes the quiz, and deletes
    // the first lesson's text artefact: none of which the writer touched
    await t.api('PATCH', teach(`/lessons/${c.lessonB}`), {
      token: owner,
      body: { title: "The owner's second lesson" },
    })
    await t.api('PATCH', teach(`/artefacts/${c.quizArtefactId}`), {
      token: owner,
      body: { title: "The owner's quiz" },
    })
    const quiz = await t.api('PUT', teach(`/artefacts/${c.quizArtefactId}/quiz`), {
      token: owner,
      body: { passMarkPercent: 80, questions: [question('q1', "The owner's question?")] },
    })
    expect(quiz.status).toBe(200)
    await t.api('DELETE', teach(`/artefacts/${c.textArtefactId}`), { token: owner })

    const changeSet = await changeSetOf(c.courseId)
    expect(changeSet.conflicts).toEqual([])
    // only the writer's own edit is waiting; the owner's are not undone by the older copies
    expect(changeSet.items).toMatchObject([{ kind: 'lesson', liveId: c.lessonA, change: 'edited' }])
    expect(changeSet.items).toHaveLength(1)

    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    expect(titles(live)).toEqual(["The writer's title", "The owner's second lesson"])
    expect(live.lessons[0]?.artefacts).toEqual([])
    expect(live.lessons[1]?.artefacts).toMatchObject([
      { id: c.quizArtefactId, title: "The owner's quiz" },
    ])
    const liveQuiz = await t.db.query.quizzes.findFirst({ where: { id: c.quizId } })
    expect(liveQuiz?.passMarkPercent).toBe(80)
    expect(await draftCount(c.courseId)).toBe(0)
  })

  it('lets an owner delete a lesson the writer left alone, and still asks once the writer edits under it', async () => {
    const quiet = await liveCourse()
    await t.api('PATCH', teach(`/lessons/${quiet.lessonA}`), {
      token: writer,
      body: { title: "The writer's title" },
    })
    await t.api('DELETE', teach(`/lessons/${quiet.lessonB}`), { token: owner })
    expect((await changeSetOf(quiet.courseId)).conflicts).toEqual([])
    const approved = await approve(quiet.courseId)
    expect(approved.status).toBe(200)
    expect(titles(approved.body.course as Course)).toEqual(["The writer's title"])
    expect(await draftCount(quiet.courseId)).toBe(0)

    // the writer edits the quiz artefact under the second lesson, then the owner deletes it
    const busy = await liveCourse()
    const res = await t.api('PATCH', teach(`/artefacts/${busy.quizArtefactId}`), {
      token: writer,
      body: { title: "The writer's quiz" },
    })
    expect(res.status).toBe(200)
    await t.api('DELETE', teach(`/lessons/${busy.lessonB}`), { token: owner })
    expect((await changeSetOf(busy.courseId)).conflicts).toMatchObject([
      { kind: 'deleted', item: 'lesson', liveId: null },
    ])
  })

  it('keeps the owner prerequisites on a lesson the writer did not touch, and applies all of a change set or none of it', async () => {
    const c = await liveCourse()
    // the writer makes the first lesson need the second
    await t.api('PUT', teach(`/lessons/${c.lessonA}/prerequisites`), {
      token: writer,
      body: { prerequisiteIds: [c.lessonB] },
    })
    await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: 'Renamed by the writer' },
    })
    // the owner adds a third lesson that needs the first, and makes the second need the third
    const added = await t.api('POST', teach(`/courses/${c.courseId}/lessons`), {
      token: owner,
      body: { title: 'Third lesson' },
    })
    const third = (added.body.course as Course).lessons.find(
      (l) => l.title === 'Third lesson',
    ) as Lesson
    await t.api('PUT', teach(`/lessons/${third.id}/prerequisites`), {
      token: owner,
      body: { prerequisiteIds: [c.lessonA] },
    })
    await t.api('PUT', teach(`/lessons/${c.lessonB}/prerequisites`), {
      token: owner,
      body: { prerequisiteIds: [third.id] },
    })

    // the writer never changed the second lesson's prerequisites, so the owner's are not a clash
    expect((await changeSetOf(c.courseId)).conflicts).toEqual([])
    // Together: first needs second (the writer), second needs third and third needs first (the
    // owner). That is a loop, so nothing is applied.
    const looped = await approve(c.courseId)
    expect(looped.status).toBe(422)
    expect(looped.body.error.code).toBe('prerequisite_cycle')
    const untouched = await tree(owner, c.courseId)
    expect(untouched.lessons[0]).toMatchObject({ title: 'First lesson', prerequisiteIds: [] })
    expect(untouched.changeSet).not.toBeNull()
    expect(await draftCount(c.courseId)).toBeGreaterThan(0)

    // The owner takes the second lesson's prerequisite off again, which breaks the loop.
    await t.api('PUT', teach(`/lessons/${c.lessonB}/prerequisites`), {
      token: owner,
      body: { prerequisiteIds: [] },
    })
    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    expect(Object.fromEntries(live.lessons.map((l) => [l.title, l.prerequisiteIds]))).toEqual({
      'Renamed by the writer': [c.lessonB],
      'Second lesson': [],
      'Third lesson': [c.lessonA],
    })
  })

  it('reports prerequisites that changed on both sides, and applies the choice made', async () => {
    const c = await liveCourse()
    // the writer makes the second lesson need the first
    await t.api('PUT', teach(`/lessons/${c.lessonB}/prerequisites`), {
      token: writer,
      body: { prerequisiteIds: [c.lessonA] },
    })
    // the owner adds a third lesson and makes the second need that instead
    const added = await t.api('POST', teach(`/courses/${c.courseId}/lessons`), {
      token: owner,
      body: { title: 'Third lesson' },
    })
    const third = (added.body.course as Course).lessons.find(
      (l) => l.title === 'Third lesson',
    ) as Lesson
    await t.api('PUT', teach(`/lessons/${c.lessonB}/prerequisites`), {
      token: owner,
      body: { prerequisiteIds: [third.id] },
    })

    const conflicts = (await changeSetOf(c.courseId)).conflicts as Conflict[]
    expect(conflicts).toMatchObject([
      { kind: 'prerequisites', item: null, id: c.lessonB, liveId: c.lessonB, seen: third.id },
    ])
    expect((await approve(c.courseId)).status).toBe(409)
    await resolve(c.courseId, [
      { kind: 'prerequisites', id: c.lessonB, keep: 'draft', seen: third.id },
    ])
    const approved = await approve(c.courseId)
    expect(approved.status).toBe(200)
    const live = approved.body.course as Course
    expect(Object.fromEntries(live.lessons.map((l) => [l.title, l.prerequisiteIds]))).toEqual({
      'First lesson': [],
      'Second lesson': [c.lessonA],
      'Third lesson': [],
    })
  })
})

describe('discarding', () => {
  it('throws the drafts away and leaves the live course as it was', async () => {
    const c = await liveCourse()
    await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: 'Not to be' },
    })
    await t.api('DELETE', teach(`/lessons/${c.lessonB}`), { token: writer })
    const discarded = await t.api('POST', teach(`/courses/${c.courseId}/change-set/discard`), {
      token: owner,
    })
    expect(discarded.status).toBe(200)
    expect(discarded.body.course).toMatchObject({ viewing: 'live', changeSet: null })
    expect(titles(discarded.body.course)).toEqual(['First lesson', 'Second lesson'])
    expect(await draftCount(c.courseId)).toBe(0)
    const stored = await t.db.query.courseChangeSets.findFirst({ where: { courseId: c.courseId } })
    expect(stored?.status).toBe('discarded')
    expect(t.mailer.sent.filter((m) => m.to === 'writer@example.com').at(-1)?.subject).toBe(
      'Your changes to "Fixture course" were not applied',
    )
    // the writer can start again: a new change set opens
    const again = await t.api('PATCH', teach(`/lessons/${c.lessonA}`), {
      token: writer,
      body: { title: 'A second try' },
    })
    expect(again.status).toBe(200)
    expect((again.body.course as Course).changeSet?.id).not.toBe(stored?.id)
  })
})
