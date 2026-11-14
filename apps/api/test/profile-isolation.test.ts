import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * One user owns two profiles. Being signed in as that user must not let a request made on one
 * profile read or change anything of the other: every Teach route names its profile in the URL,
 * and every lookup is scoped to it.
 *
 * The second profile is a corporate one, written straight to the database, because nothing in
 * the product creates a second profile for a user yet.
 */
let t: TestApp
let token: string
let personal: string
let corporate: string
type Fixture = Awaited<ReturnType<TestApp['createCourse']>>
let inPersonal: Fixture
let inCorporate: Fixture
let liveInCorporate: Fixture

const on = (profileId: string, path: string) => `/api/teach/profiles/${profileId}${path}`

const quiz = {
  passMarkPercent: 50,
  questions: [
    {
      id: 'q1',
      prompt: 'Is this the right profile?',
      options: [
        { id: 'a', text: 'Yes', correct: true },
        { id: 'b', text: 'No', correct: false },
      ],
    },
  ],
}

/** Every Teach route that takes the ID of a course, lesson or artefact, aimed at `target`. */
function resourceRoutes(target: Fixture): Array<[method: string, path: string, body?: unknown]> {
  return [
    ['GET', `/courses/${target.courseId}`],
    ['PATCH', `/courses/${target.courseId}`, { title: 'Reached from the wrong profile' }],
    ['PUT', `/courses/${target.courseId}/price`, { priceCents: 1 }],
    ['DELETE', `/courses/${target.courseId}`],
    ['POST', `/courses/${target.courseId}/submit`],
    ['POST', `/courses/${target.courseId}/lessons`, { title: 'Injected lesson' }],
    ['PUT', `/courses/${target.courseId}/lessons/order`, { ids: [target.lessonB, target.lessonA] }],
    ['PATCH', `/lessons/${target.lessonA}`, { title: 'Reached from the wrong profile' }],
    ['DELETE', `/lessons/${target.lessonA}`],
    ['PUT', `/lessons/${target.lessonB}/prerequisites`, { prerequisiteIds: [target.lessonA] }],
    ['POST', `/lessons/${target.lessonA}/artefacts`, { type: 'text', title: 'Injected artefact' }],
    ['PUT', `/lessons/${target.lessonA}/artefacts/order`, { ids: [target.textArtefactId] }],
    ['PATCH', `/artefacts/${target.textArtefactId}`, { title: 'Reached from the wrong profile' }],
    ['DELETE', `/artefacts/${target.textArtefactId}`],
    ['PUT', `/artefacts/${target.quizArtefactId}/quiz`, quiz],
    ['GET', `/earnings/courses/${target.courseId}`],
  ]
}

const tree = async (profileId: string, courseId: string) =>
  (await t.api('GET', on(profileId, `/courses/${courseId}`), { token })).body.course

beforeAll(async () => {
  t = await createTestApp()
  personal = (
    await t.createProfile('two-hats@example.com', { displayName: 'Jo Tan', payable: true })
  ).profile.id
  corporate = (
    await t.createProfile('two-hats@example.com', {
      displayName: 'Tan Studio Pte Ltd',
      type: 'corporate',
      payable: true,
    })
  ).profile.id
  inPersonal = await t.createCourse(personal, { title: 'Personal course' })
  inCorporate = await t.createCourse(corporate, { title: 'Corporate course' })
  liveInCorporate = await t.createCourse(corporate, { title: 'Corporate live', status: 'live' })
  token = (await t.signIn('two-hats@example.com', 'teach')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('profile isolation', () => {
  it('shows the user both profiles, each with its own course list', async () => {
    const me = await t.api('GET', '/api/auth/me', { token })
    expect(me.body.user.profiles.map((p: { id: string }) => p.id).sort()).toEqual(
      [personal, corporate].sort(),
    )
    const ids = async (profileId: string) =>
      (await t.api('GET', on(profileId, '/courses'), { token })).body.items.map(
        (c: { id: string }) => c.id,
      )
    expect(await ids(personal)).toEqual([inPersonal.courseId])
    expect((await ids(corporate)).sort()).toEqual(
      [inCorporate.courseId, liveInCorporate.courseId].sort(),
    )
  })

  it('answers 404 on the personal profile for every resource of the corporate one', async () => {
    const before = await tree(corporate, inCorporate.courseId)
    for (const [method, path, body] of resourceRoutes(inCorporate)) {
      const res = await t.api(method, on(personal, path), { token, body })
      expect(res.status, `${method} ${path}`).toBe(404)
    }
    // nothing of the corporate course changed
    expect(await tree(corporate, inCorporate.courseId)).toEqual(before)
  })

  it('answers 404 the other way round as well', async () => {
    const before = await tree(personal, inPersonal.courseId)
    for (const [method, path, body] of resourceRoutes(inPersonal)) {
      const res = await t.api(method, on(corporate, path), { token, body })
      expect(res.status, `${method} ${path}`).toBe(404)
    }
    expect(await tree(personal, inPersonal.courseId)).toEqual(before)
  })

  it('reaches the same resources through their own profile', async () => {
    // The 404s above are about the profile, not about the requests: each one is accepted
    // (anything but 403 or 404) when it is made on the profile the resource belongs to.
    const own = await t.createCourse(personal, { title: 'Throwaway' })
    for (const [method, path, body] of resourceRoutes(own)) {
      // Deleting comes last below, so the other routes still have something to act on.
      if (method === 'DELETE') continue
      const res = await t.api(method, on(personal, path), { token, body })
      expect([403, 404], `${method} ${path}`).not.toContain(res.status)
    }
    for (const path of [
      `/artefacts/${own.textArtefactId}`,
      `/lessons/${own.lessonA}`,
      `/courses/${own.courseId}`,
    ]) {
      const res = await t.api('DELETE', on(personal, path), { token })
      expect([403, 404], `DELETE ${path}`).not.toContain(res.status)
    }
  })

  it('refuses to tie a lesson or an order to resources of the other profile', async () => {
    const prerequisite = await t.api(
      'PUT',
      on(personal, `/lessons/${inPersonal.lessonB}/prerequisites`),
      { token, body: { prerequisiteIds: [inCorporate.lessonA] } },
    )
    expect(prerequisite.status).toBe(422)
    const lessons = await t.api(
      'PUT',
      on(personal, `/courses/${inPersonal.courseId}/lessons/order`),
      {
        token,
        body: { ids: [inPersonal.lessonA, inCorporate.lessonA] },
      },
    )
    expect(lessons.status).toBe(400)
    const artefacts = await t.api(
      'PUT',
      on(personal, `/lessons/${inPersonal.lessonA}/artefacts/order`),
      { token, body: { ids: [inCorporate.textArtefactId] } },
    )
    expect(artefacts.status).toBe(400)
    const edges = await t.db.query.lessonPrerequisites.findMany({
      where: { lessonId: inPersonal.lessonB },
    })
    expect(edges).toEqual([])
  })

  it('keeps the earnings of the two profiles apart', async () => {
    const buyer = (await t.signIn('buyer@example.com')).token as string
    const start = await t.api('POST', `/api/checkout/courses/${liveInCorporate.courseId}`, {
      token: buyer,
      body: {},
    })
    expect(start.body.kind).toBe('redirect')
    const hook = await t.stripeWebhook(t.payments.completeCheckout(start.body.sessionId))
    expect(hook.body.outcome).toBe('applied')

    const corporateEarnings = await t.api('GET', on(corporate, '/earnings'), { token })
    expect(corporateEarnings.body.earnings.totals.paymentCount).toBe(1)
    const personalEarnings = await t.api('GET', on(personal, '/earnings'), { token })
    expect(personalEarnings.body.earnings.totals).toMatchObject({ paymentCount: 0, netCents: 0 })
    expect(
      personalEarnings.body.earnings.courses.map((c: { courseId: string }) => c.courseId),
    ).toEqual([inPersonal.courseId])
    expect(
      (await t.api('GET', on(personal, `/earnings/courses/${liveInCorporate.courseId}`), { token }))
        .status,
    ).toBe(404)
    const reconcile = await t.api('GET', on(personal, '/earnings/reconcile'), { token })
    expect(reconcile.body.reconciliation).toMatchObject({
      ledgerNetCents: 0,
      stripeTransferTotalCents: 0,
    })
  })

  it('answers 404 for a profile the caller is not on, and for IDs that are not IDs', async () => {
    const stranger = (await t.signIn('stranger@example.com', 'teach')).token as string
    for (const path of ['/profile', '/courses', '/earnings', '/stripe/status']) {
      expect((await t.api('GET', on(personal, path), { token: stranger })).status, path).toBe(404)
    }
    const nowhere = '00000000-0000-4000-8000-000000000000'
    expect((await t.api('GET', on(nowhere, '/profile'), { token })).status).toBe(404)
    expect((await t.api('GET', on('not-an-id', '/profile'), { token })).status).toBe(404)
    expect((await t.api('GET', on(personal, '/courses/not-an-id'), { token })).status).toBe(404)
    expect(
      (await t.api('PATCH', on(personal, '/lessons/undefined'), { token, body: { title: 'x' } }))
        .status,
    ).toBe(404)
    // and with no session at all, the answer is to sign in
    expect((await t.api('GET', on(personal, '/profile'))).status).toBe(401)
  })
})
