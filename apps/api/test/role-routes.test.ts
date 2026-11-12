import { type Actor, type Capability, can } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Every route under `/teach/profiles/:profileId`, with the capability it needs. This is the route
 * table from the design, written out: a route that is added without a row here fails the first
 * test, and a route that enforces a different capability fails one of the others.
 *
 * Three markers stand for rules that are not one fixed capability:
 * - `content`: lessons, artefacts, quizzes and prerequisites. `course.editDraft` on a course that
 *   is not live; on a live one `course.editLive`, or `course.proposeLiveEdit` for edits that wait
 *   in a change set.
 * - `details`: the course's own details. `course.editDraft`, or `course.editLive` on a live
 *   course; they are not part of a change set.
 * - `membership`: leaving. It needs no capability, only a membership, and has its own test.
 */
type Status = 'draft' | 'rejected' | 'pending_review' | 'live'
type Fixture = Awaited<ReturnType<TestApp['createCourse']>> & {
  /** A pending writer invitation on the profile. */
  invitationId: string
  /** A writer on the profile, other than whoever is calling. */
  memberId: string
}
type Route = {
  method: string
  /** As registered, after `/teach/profiles/:profileId/`. */
  pattern: string
  capability: Capability | 'content' | 'details' | 'membership'
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
  { method: 'GET', pattern: 'members', capability: 'members.read', path: () => '/members' },
  {
    method: 'POST',
    pattern: 'invitations',
    capability: 'members.manageWriters',
    path: () => '/invitations',
    body: () => ({ email: 'invited-by-the-table@example.com', role: 'writer' }),
  },
  {
    method: 'POST',
    pattern: 'invitations/:id/resend',
    capability: 'members.manageWriters',
    path: (f) => `/invitations/${f.invitationId}/resend`,
  },
  {
    // The fixture's invitation is not waiting for confirmation, so the owner gets a 409 here.
    method: 'POST',
    pattern: 'invitations/:id/confirm',
    capability: 'members.manageManagers',
    path: (f) => `/invitations/${f.invitationId}/confirm`,
  },
  {
    // 409 on a personal profile, which has no manager role; still not a 403 for the owner.
    method: 'PATCH',
    pattern: 'members/:userId',
    capability: 'members.manageManagers',
    path: (f) => `/members/${f.memberId}`,
    body: () => ({ role: 'manager' }),
  },
  { method: 'DELETE', pattern: 'members/me', capability: 'membership', path: () => '/members/me' },
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
    capability: 'details',
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
    method: 'GET',
    pattern: 'courses/:id/change-set',
    capability: 'profile.read',
    path: (f) => `/courses/${f.courseId}/change-set`,
  },
  // With no change set open these three answer 409 to someone who may review: not 403, not 404.
  {
    method: 'POST',
    pattern: 'courses/:id/change-set/resolve',
    capability: 'changeSet.review',
    path: (f) => `/courses/${f.courseId}/change-set/resolve`,
    body: (f) => ({ choices: [{ kind: 'edited', id: f.lessonA, keep: 'live', seen: 'then' }] }),
  },
  {
    method: 'POST',
    pattern: 'courses/:id/change-set/approve',
    capability: 'changeSet.review',
    path: (f) => `/courses/${f.courseId}/change-set/approve`,
  },
  {
    method: 'POST',
    pattern: 'courses/:id/change-set/discard',
    capability: 'changeSet.review',
    path: (f) => `/courses/${f.courseId}/change-set/discard`,
  },
  {
    method: 'DELETE',
    pattern: 'invitations/:id',
    capability: 'members.manageWriters',
    path: (f) => `/invitations/${f.invitationId}`,
  },
  {
    method: 'DELETE',
    pattern: 'members/:userId',
    capability: 'members.manageWriters',
    path: (f) => `/members/${f.memberId}`,
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
/** An approved personal profile, owned by owner@example.com, with writer@example.com on it. */
let approved: string
/** An approved corporate profile, with manager@example.com on it. */
let company: string
/** A personal profile that is still awaiting approval. */
let applied: string

const STATUSES: Status[] = ['draft', 'rejected', 'pending_review', 'live']

/** What the role table says about a route for an actor, on a course in this status. */
function allowed(actor: Actor, route: Route, status: Status = 'draft'): boolean {
  if (route.capability === 'membership') throw new Error('leaving has its own test')
  if (route.capability === 'content') {
    return status === 'live'
      ? can(actor, 'course.editLive') || can(actor, 'course.proposeLiveEdit')
      : can(actor, 'course.editDraft')
  }
  if (route.capability === 'details') {
    return can(actor, status === 'live' ? 'course.editLive' : 'course.editDraft')
  }
  return can(actor, route.capability)
}

let fixtures = 0

/** A course in the given status, a pending invitation and a writer, all on the profile. */
async function fixture(profileId: string, status: Status = 'draft'): Promise<Fixture> {
  const n = ++fixtures
  const course = await t.createCourse(profileId, { status })
  const member = await t.addMember(profileId, `fixture-writer-${n}@example.com`, 'writer')
  const [invitation] = await t.db
    .insert(s.profileInvitations)
    .values({
      profileId,
      email: `fixture-invitee-${n}@example.com`,
      role: 'writer',
      tokenHash: `fixture-token-${n}`,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      // Old enough not to count toward the profile's sending limit.
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    .returning()
  if (!invitation) throw new Error('failed to create the invitation')
  return { ...course, invitationId: invitation.id, memberId: member.id }
}

/**
 * Calls every route as `token` on `profileId` and returns the status of each, by route. Leaving
 * is left out unless asked for: a member who has left is not on the profile for the next route.
 */
async function callAll(token: string, profileId: string, f: Fixture, leaving = false) {
  const statuses = new Map<Route, number>()
  for (const route of ROUTES) {
    if (route.capability === 'membership' && !leaving) continue
    const res = await t.api(route.method, `/api/teach/profiles/${profileId}${route.path(f)}`, {
      token,
      body: route.body?.(f),
    })
    statuses.set(route, res.status)
  }
  return statuses
}

const label = (route: Route) => `${route.method} ${route.pattern}`

/** One session per person for the whole file: sign-in links are limited per address. */
const sessions = new Map<string, string>()
async function signIn(email: string): Promise<string> {
  const existing = sessions.get(email)
  if (existing) return existing
  const token = (await t.signIn(email, 'teach')).token as string
  sessions.set(email, token)
  return token
}

/**
 * Calls every route and checks each answer against the role table: a route the actor may use is
 * never 401, 403 or 404, and one they may not use is exactly 403. Returns the refused routes.
 */
async function checkAgainstTable(
  actor: Actor,
  email: string,
  profileId: string,
  status: Status = 'draft',
): Promise<string[]> {
  const statuses = await callAll(await signIn(email), profileId, await fixture(profileId, status))
  const refused: string[] = []
  for (const [route, got] of statuses) {
    const where = `${label(route)} on a ${status} course`
    if (allowed(actor, route, status)) {
      expect([401, 403, 404], where).not.toContain(got)
      expect(got, where).toBeLessThan(500)
    } else {
      expect(got, where).toBe(403)
      refused.push(label(route))
    }
  }
  return refused.sort()
}

const OWNER: Actor = { role: 'owner', profileType: 'personal', profileStatus: 'approved' }
const MANAGER: Actor = { role: 'manager', profileType: 'corporate', profileStatus: 'approved' }
const WRITER: Actor = { role: 'writer', profileType: 'personal', profileStatus: 'approved' }
const STAFF: Actor = { role: 'staff', profileType: 'personal', profileStatus: 'approved' }

const MEMBER_ROUTES = [
  'POST invitations',
  'POST invitations/:id/resend',
  'POST invitations/:id/confirm',
  'DELETE invitations/:id',
  'DELETE members/:userId',
  'PATCH members/:userId',
]
const REVIEW_ROUTES = [
  'POST courses/:id/change-set/resolve',
  'POST courses/:id/change-set/approve',
  'POST courses/:id/change-set/discard',
]
const STRIPE_LINKS = ['POST stripe/onboarding-link', 'POST stripe/login-link']
const PUBLISHING = ['PUT courses/:id/price', 'POST courses/:id/submit', 'DELETE courses/:id']
const EARNINGS = ['GET earnings', 'GET earnings/reconcile', 'GET earnings/courses/:id']

beforeAll(async () => {
  t = await createTestApp()
  approved = (await t.createProfile('owner@example.com', { payable: true })).profile.id
  company = (await t.createProfile('boss@example.com', { type: 'corporate', payable: true }))
    .profile.id
  applied = (await t.createProfile('applicant@example.com', { status: 'applied' })).profile.id
  await t.addMember(approved, 'writer@example.com', 'writer')
  await t.addMember(company, 'manager@example.com', 'manager')
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

  for (const status of STATUSES) {
    it(`lets the owner of an approved profile use every route, on a ${status} course`, async () => {
      expect(await checkAgainstTable(OWNER, 'owner@example.com', approved, status)).toEqual([])
    })

    it(`gives a manager everything but Stripe links and managers, on a ${status} course`, async () => {
      const refused = await checkAgainstTable(MANAGER, 'manager@example.com', company, status)
      expect(refused).toEqual(
        [...STRIPE_LINKS, 'POST invitations/:id/confirm', 'PATCH members/:userId'].sort(),
      )
    })

    it(`refuses a writer money, publishing, members and Stripe, on a ${status} course`, async () => {
      const refused = await checkAgainstTable(WRITER, 'writer@example.com', approved, status)
      // Written out, so a change to what a writer may do shows up here as well as in the table.
      expect(refused).toEqual(
        [
          'PATCH profile',
          ...STRIPE_LINKS,
          ...EARNINGS,
          ...PUBLISHING,
          'GET members',
          ...MEMBER_ROUTES,
          ...REVIEW_ROUTES,
          // a live course's details are not a writer's to change, even as a proposal
          ...(status === 'live' ? ['PATCH courses/:id'] : []),
        ].sort(),
      )
    })

    it(`gives staff exactly the staff row, on a ${status} course`, async () => {
      const refused = await checkAgainstTable(STAFF, 'root@example.com', approved, status)
      expect(refused).toEqual(
        [...STRIPE_LINKS, 'POST courses', ...PUBLISHING, ...MEMBER_ROUTES, ...REVIEW_ROUTES].sort(),
      )
    })
  }

  it('lets the owner of a profile awaiting approval read and edit the profile, and nothing else', async () => {
    const actor: Actor = { role: 'owner', profileType: 'personal', profileStatus: 'applied' }
    // The course is written to the database so each route has a real ID to refuse.
    const refused = await checkAgainstTable(actor, 'applicant@example.com', applied)
    const permitted = ROUTES.map(label).filter(
      (route) => !refused.includes(route) && route !== 'DELETE members/me',
    )
    expect(permitted.sort()).toEqual(
      [
        'GET profile',
        'PATCH profile',
        'GET stripe/status',
        'GET courses',
        'GET courses/:id',
        'GET courses/:id/change-set',
      ].sort(),
    )
  })

  it('lets a writer on a profile awaiting approval read, and nothing else', async () => {
    await t.addMember(applied, 'early-writer@example.com', 'writer')
    const actor: Actor = { role: 'writer', profileType: 'personal', profileStatus: 'applied' }
    const refused = await checkAgainstTable(actor, 'early-writer@example.com', applied)
    const permitted = ROUTES.map(label).filter(
      (route) => !refused.includes(route) && route !== 'DELETE members/me',
    )
    expect(permitted.sort()).toEqual(
      [
        'GET profile',
        'GET stripe/status',
        'GET courses',
        'GET courses/:id',
        'GET courses/:id/change-set',
      ].sort(),
    )
  })

  it('lets a member leave, and nobody who is not a member', async () => {
    const leave = async (email: string, profileId: string) =>
      (
        await t.api('DELETE', `/api/teach/profiles/${profileId}/members/me`, {
          token: await signIn(email),
        })
      ).status
    // the owner is not a member and cannot leave; staff do not belong to the profile
    expect(await leave('owner@example.com', approved)).toBe(409)
    expect(await leave('root@example.com', approved)).toBe(404)
    await t.addMember(company, 'leaving-manager@example.com', 'manager')
    await t.addMember(approved, 'leaving-writer@example.com', 'writer')
    expect(await leave('leaving-manager@example.com', company)).toBe(200)
    expect(await leave('leaving-writer@example.com', approved)).toBe(200)
    // once gone, the profile is not found for them
    expect(await leave('leaving-writer@example.com', approved)).toBe(404)
  })

  it('answers 404 on every route to a signed-in user who is not on the profile', async () => {
    const f = await fixture(approved)
    const statuses = await callAll(await signIn('stranger@example.com'), approved, f, true)
    expect(statuses.size).toBe(ROUTES.length)
    for (const [route, status] of statuses) expect(status, label(route)).toBe(404)
    // a support agent is a stranger here too, and so is a member of another profile
    await t.grantRole('agent@example.com', 'support_agent')
    for (const email of ['agent@example.com', 'manager@example.com']) {
      for (const [route, status] of await callAll(await signIn(email), approved, f, true)) {
        expect(status, `${email}: ${label(route)}`).toBe(404)
      }
    }
    // nothing was changed by any of them
    const course = await t.db.query.courses.findFirst({ where: { id: f.courseId } })
    expect(course).toMatchObject({ title: 'Fixture course', priceCents: 5000, status: 'draft' })
    expect(
      await t.db.query.profileMemberships.findFirst({
        where: { profileId: approved, userId: f.memberId },
      }),
    ).toBeDefined()
    expect(
      (await t.db.query.profileInvitations.findFirst({ where: { id: f.invitationId } }))?.status,
    ).toBe('pending')
  })

  it('answers 401 on every route with no session', async () => {
    const f = await fixture(approved)
    for (const route of ROUTES) {
      const res = await t.api(route.method, `/api/teach/profiles/${approved}${route.path(f)}`, {
        body: route.body?.(f),
      })
      expect(res.status, label(route)).toBe(401)
    }
  })

  it('applies the live-course rule to content routes', async () => {
    const live = await fixture(approved, 'live')
    const path = `/api/teach/profiles/${approved}/lessons/${live.lessonA}`
    // the owner and staff change the live lesson
    for (const email of ['owner@example.com', 'root@example.com']) {
      const res = await t.api('PATCH', path, {
        token: await signIn(email),
        body: { title: 'Edited while live' },
      })
      expect(res.status).toBe(200)
      expect(res.body.course.viewing).toBe('live')
    }
    // a writer's edit is accepted too, but lands on a draft: the live lesson is as it was
    const proposed = await t.api('PATCH', path, {
      token: await signIn('writer@example.com'),
      body: { title: 'Proposed by a writer' },
    })
    expect(proposed.status).toBe(200)
    expect(proposed.body.course.viewing).toBe('draft')
    const lesson = await t.db.query.lessons.findFirst({ where: { id: live.lessonA } })
    expect(lesson?.title).toBe('Edited while live')
  })
})
