import { type Actor, type Capability, can } from '@elevate/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Every route under `/teach/profiles/:profileId`, with the capability it needs. This is the route
 * table from the design, written out: a route that is added without a row here fails the first
 * test, and a route that enforces a different capability fails one of the others.
 *
 * `content` marks the routes whose capability depends on the course: `course.editDraft` for a
 * draft or rejected course (the fixture is a draft), `course.editLive` for a live one.
 */
type Fixture = Awaited<ReturnType<TestApp['createCourse']>>
type Route = {
  method: string
  /** As registered, after `/teach/profiles/:profileId/`. */
  pattern: string
  capability: Capability | 'content'
  path: (f: Fixture) => string
  body?: (f: Fixture) => unknown
}

const quiz = {
  passMarkPercent: 50,
  questions: [
    {
      id: 'q1',
      prompt: 'One plus one?',
      options: [
        { id: 'a', text: 'Two', correct: true },
        { id: 'b', text: 'Three', correct: false },
      ],
    },
  ],
}

// Deletions are last, so every other route still has its course, lesson and artefact.
const ROUTES: Route[] = [
  { method: 'GET', pattern: 'profile', capability: 'profile.read', path: () => '/profile' },
  {
    method: 'PATCH',
    pattern: 'profile',
    capability: 'profile.edit',
    path: () => '/profile',
    body: () => ({ headline: 'A headline that is long enough' }),
  },
  {
    method: 'GET',
    pattern: 'stripe/status',
    capability: 'profile.read',
    path: () => '/stripe/status',
  },
  {
    method: 'POST',
    pattern: 'stripe/onboarding-link',
    capability: 'stripe.links',
    path: () => '/stripe/onboarding-link',
  },
  {
    method: 'POST',
    pattern: 'stripe/login-link',
    capability: 'stripe.links',
    path: () => '/stripe/login-link',
  },
  { method: 'GET', pattern: 'earnings', capability: 'earnings.read', path: () => '/earnings' },
  {
    method: 'GET',
    pattern: 'earnings/reconcile',
    capability: 'earnings.read',
    path: () => '/earnings/reconcile',
  },
  {
    method: 'GET',
    pattern: 'earnings/courses/:id',
    capability: 'earnings.read',
    path: (f) => `/earnings/courses/${f.courseId}`,
  },
  { method: 'GET', pattern: 'courses', capability: 'profile.read', path: () => '/courses' },
  {
    method: 'POST',
    pattern: 'courses',
    capability: 'course.create',
    path: () => '/courses',
    body: () => ({ title: 'A brand new course', category: 'craft-making' }),
  },
  {
    method: 'GET',
    pattern: 'courses/:id',
    capability: 'profile.read',
    path: (f) => `/courses/${f.courseId}`,
  },
  {
    method: 'PATCH',
    pattern: 'courses/:id',
    capability: 'content',
    path: (f) => `/courses/${f.courseId}`,
    body: () => ({ summary: 'A summary for the course.' }),
  },
  {
    method: 'PUT',
    pattern: 'courses/:id/price',
    capability: 'course.setPrice',
    path: (f) => `/courses/${f.courseId}/price`,
    body: () => ({ priceCents: 6000 }),
  },
  {
    method: 'POST',
    pattern: 'courses/:id/submit',
    capability: 'course.submit',
    path: (f) => `/courses/${f.courseId}/submit`,
  },
  {
    method: 'POST',
    pattern: 'courses/:id/lessons',
    capability: 'content',
    path: (f) => `/courses/${f.courseId}/lessons`,
    body: () => ({ title: 'Another lesson' }),
  },
  {
    method: 'PATCH',
    pattern: 'lessons/:id',
    capability: 'content',
    path: (f) => `/lessons/${f.lessonA}`,
    body: () => ({ title: 'First lesson, renamed' }),
  },
  {
    method: 'PUT',
    pattern: 'lessons/:id/prerequisites',
    capability: 'content',
    path: (f) => `/lessons/${f.lessonB}/prerequisites`,
    body: (f) => ({ prerequisiteIds: [f.lessonA] }),
  },
  {
    method: 'POST',
    pattern: 'lessons/:id/artefacts',
    capability: 'content',
    path: (f) => `/lessons/${f.lessonA}/artefacts`,
    body: () => ({ type: 'text', title: 'Another artefact' }),
  },
  {
    method: 'PUT',
    pattern: 'lessons/:id/artefacts/order',
    capability: 'content',
    path: (f) => `/lessons/${f.lessonB}/artefacts/order`,
    body: (f) => ({ ids: [f.quizArtefactId] }),
  },
  {
    method: 'PATCH',
    pattern: 'artefacts/:id',
    capability: 'content',
    path: (f) => `/artefacts/${f.textArtefactId}`,
    body: () => ({ title: 'Read this, renamed' }),
  },
  {
    method: 'PUT',
    pattern: 'artefacts/:id/quiz',
    capability: 'content',
    path: (f) => `/artefacts/${f.quizArtefactId}/quiz`,
    body: () => quiz,
  },
  {
    method: 'PUT',
    pattern: 'courses/:id/lessons/order',
    capability: 'content',
    // Rejected as a mismatch once lessons have been added above; it is still not a 403 or 404.
    path: (f) => `/courses/${f.courseId}/lessons/order`,
    body: (f) => ({ ids: [f.lessonB, f.lessonA] }),
  },
  {
    method: 'DELETE',
    pattern: 'artefacts/:id',
    capability: 'content',
    path: (f) => `/artefacts/${f.textArtefactId}`,
  },
  {
    method: 'DELETE',
    pattern: 'lessons/:id',
    capability: 'content',
    path: (f) => `/lessons/${f.lessonA}`,
  },
  {
    method: 'DELETE',
    pattern: 'courses/:id',
    capability: 'course.delete',
    path: (f) => `/courses/${f.courseId}`,
  },
]

let t: TestApp
let approved: string
let applied: string

/** What the role table says about a route for an actor, on a draft course. */
function allowed(actor: Actor, route: Route): boolean {
  return can(actor, route.capability === 'content' ? 'course.editDraft' : route.capability)
}

/** Calls every route as `token` on `profileId` and returns the status of each, by route. */
async function callAll(token: string, profileId: string, fixture: Fixture) {
  const statuses = new Map<Route, number>()
  for (const route of ROUTES) {
    const res = await t.api(
      route.method,
      `/api/teach/profiles/${profileId}${route.path(fixture)}`,
      {
        token,
        body: route.body?.(fixture),
      },
    )
    statuses.set(route, res.status)
  }
  return statuses
}

const label = (route: Route) => `${route.method} ${route.pattern}`

beforeAll(async () => {
  t = await createTestApp()
  approved = (await t.createProfile('owner@example.com', { payable: true })).profile.id
  applied = (await t.createProfile('applicant@example.com', { status: 'applied' })).profile.id
  await t.grantRole('root@example.com', 'super_admin')
})
afterAll(async () => {
  await t.close()
})

describe('the role table, route by route', () => {
  it('has a row for every route registered under a profile', () => {
    const prefix = '/api/teach/profiles/:profileId/'
    const registered = new Set(
      t.app.routes
        .filter((route) => route.path.startsWith(prefix) && route.method !== 'ALL')
        .map((route) => `${route.method} ${route.path.slice(prefix.length)}`),
    )
    expect([...registered].sort()).toEqual(ROUTES.map(label).sort())
  })

  it('lets the owner of an approved profile use every route', async () => {
    const token = (await t.signIn('owner@example.com', 'teach')).token as string
    const statuses = await callAll(token, approved, await t.createCourse(approved))
    for (const [route, status] of statuses) {
      expect([401, 403, 404], label(route)).not.toContain(status)
      expect(status, label(route)).toBeLessThan(500)
    }
  })

  it('gives staff exactly the staff row', async () => {
    const actor: Actor = { role: 'staff', profileType: 'personal', profileStatus: 'approved' }
    const token = (await t.signIn('root@example.com', 'teach')).token as string
    const statuses = await callAll(token, approved, await t.createCourse(approved))
    const refused: string[] = []
    for (const [route, status] of statuses) {
      if (allowed(actor, route)) {
        expect([401, 403, 404], label(route)).not.toContain(status)
        expect(status, label(route)).toBeLessThan(500)
      } else {
        expect(status, label(route)).toBe(403)
        refused.push(label(route))
      }
    }
    // Written out, so a change to what staff may do shows up here as well as in the table.
    expect(refused.sort()).toEqual(
      [
        'POST stripe/onboarding-link',
        'POST stripe/login-link',
        'POST courses',
        'PUT courses/:id/price',
        'POST courses/:id/submit',
        'DELETE courses/:id',
      ].sort(),
    )
  })

  it('lets the owner of a profile awaiting approval read and edit the profile, and nothing else', async () => {
    const actor: Actor = { role: 'owner', profileType: 'personal', profileStatus: 'applied' }
    const token = (await t.signIn('applicant@example.com', 'teach')).token as string
    // The course is written to the database so each route has a real ID to refuse.
    const statuses = await callAll(token, applied, await t.createCourse(applied))
    const permitted: string[] = []
    for (const [route, status] of statuses) {
      if (allowed(actor, route)) {
        expect([401, 403, 404], label(route)).not.toContain(status)
        permitted.push(label(route))
      } else {
        expect(status, label(route)).toBe(403)
      }
    }
    expect(permitted.sort()).toEqual(
      [
        'GET profile',
        'PATCH profile',
        'GET stripe/status',
        'GET courses',
        'GET courses/:id',
      ].sort(),
    )
  })

  it('answers 404 on every route to a signed-in user who is not on the profile', async () => {
    const fixture = await t.createCourse(approved)
    const token = (await t.signIn('stranger@example.com', 'teach')).token as string
    const statuses = await callAll(token, approved, fixture)
    for (const [route, status] of statuses) expect(status, label(route)).toBe(404)
    // a support agent is a stranger here too
    await t.grantRole('agent@example.com', 'support_agent')
    const agent = (await t.signIn('agent@example.com', 'teach')).token as string
    for (const [route, status] of await callAll(agent, approved, fixture)) {
      expect(status, label(route)).toBe(404)
    }
    // nothing was changed by either of them
    const course = await t.db.query.courses.findFirst({ where: { id: fixture.courseId } })
    expect(course).toMatchObject({ title: 'Fixture course', priceCents: 5000, status: 'draft' })
  })

  it('answers 401 on every route with no session', async () => {
    const fixture = await t.createCourse(approved)
    for (const route of ROUTES) {
      const res = await t.api(
        route.method,
        `/api/teach/profiles/${approved}${route.path(fixture)}`,
        {
          body: route.body?.(fixture),
        },
      )
      expect(res.status, label(route)).toBe(401)
    }
  })

  it('applies the live-course rule to content routes', async () => {
    const live = await t.createCourse(approved, { status: 'live' })
    const owner = (await t.signIn('owner@example.com', 'teach')).token as string
    const staff = (await t.signIn('root@example.com', 'teach')).token as string
    const path = `/api/teach/profiles/${approved}/lessons/${live.lessonA}`
    for (const token of [owner, staff]) {
      const res = await t.api('PATCH', path, { token, body: { title: 'Edited while live' } })
      expect(res.status).toBe(200)
    }
  })
})
