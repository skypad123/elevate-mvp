import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The `CLASSES` setting (docs/designs/scheduled-classes-attendance.md, "The `CLASSES` setting").
 * Off: `GET /me/classes` answers an empty list, Support's features say so, and every other class
 * route answers 404, even with a class in the database.
 */
let t: TestApp
let profileId: string

const ID = '00000000-0000-4000-8000-000000000000'

beforeAll(async () => {
  t = await createTestApp({ CLASSES: 'false' })
  profileId = (await t.createProfile('owner@example.com')).profile.id
})
afterAll(async () => {
  await t.close()
})

describe('with CLASSES off', () => {
  it('lists no classes, says so to Support and the Teach profile, and 404s every other route', async () => {
    const courseId = (await t.createCourse(profileId, { status: 'live' })).courseId
    const { classId, blockId } = await t.createClass(profileId, courseId)
    const enrollment = await t.enrolInClass('learner@example.com', classId)
    const learner = (await t.signIn('learner@example.com')).token
    const owner = (await t.signIn('owner@example.com', 'teach')).token
    await t.grantRole('agent@example.com', 'support_agent')
    const agent = (await t.signIn('agent@example.com', 'support')).token

    expect((await t.api('GET', '/api/me/classes', { token: learner })).body).toEqual({ items: [] })
    const features = await t.api('GET', '/api/support/features', { token: agent })
    expect(features.status).toBe(200)
    expect(features.body).toEqual({ classes: false })
    const profile = await t.api('GET', `/api/teach/profiles/${profileId}/profile`, {
      token: owner,
    })
    expect(profile.body.profile.classesEnabled).toBe(false)

    const teach = `/api/teach/profiles/${profileId}/classes`
    const learnerPath = `${teach}/${classId}/blocks/${blockId}/learners/${enrollment.id}`
    const routes: [string, string, string | undefined, unknown?][] = [
      ['GET', teach, owner],
      ['POST', teach, owner, {}],
      ['GET', `${teach}/${classId}`, owner],
      ['PATCH', `${teach}/${classId}`, owner, { name: 'x' }],
      ['POST', `${teach}/${classId}/publish`, owner],
      ['PUT', `${teach}/${classId}/instructor`, owner, { userId: ID }],
      ['DELETE', `${teach}/${classId}`, owner],
      ['GET', `${teach}/${classId}/blocks/${blockId}/roster`, owner],
      ['GET', `${teach}/${classId}/blocks/${blockId}/code`, owner],
      ['PUT', `${teach}/${classId}/venue-location`, owner, { lat: 1, lng: 1, accuracyM: 1 }],
      ['POST', `${learnerPath}/overturn`, owner, { reasonCode: 'not_in_room' }],
      ['POST', `${learnerPath}/manual-mark`, owner, { reasonCode: 'no_phone' }],
      ['GET', `${teach}/${classId}/disputes`, owner],
      ['POST', `${teach}/${classId}/disputes/${ID}/decision`, owner, { decision: 'upheld' }],
      ['GET', `/api/me/classes/blocks/${blockId}`, learner],
      ['POST', `/api/me/classes/blocks/${blockId}/check-in`, learner, {}],
      ['POST', `/api/me/classes/attendance/${ID}/dispute`, learner, { reason: 'x' }],
      ['GET', '/api/support/classes?q=Fixture', agent],
      ['GET', `/api/support/classes/${classId}`, agent],
      ['GET', `/api/support/classes/${classId}/blocks/${blockId}`, agent],
    ]
    for (const [method, path, token, body] of routes) {
      const res = await t.api(method, path, { token, body })
      expect(res.status, `${method} ${path}`).toBe(404)
    }
    expect(await t.db.query.attendanceEvents.findMany()).toEqual([])
  })
})

describe('with CLASSES on', () => {
  it('tells Support and the Teach profile', async () => {
    const on = await createTestApp()
    try {
      await on.grantRole('agent@example.com', 'support_agent')
      const agent = (await on.signIn('agent@example.com', 'support')).token
      expect((await on.api('GET', '/api/support/features', { token: agent })).body).toEqual({
        classes: true,
      })
      const id = (await on.createProfile('owner@example.com')).profile.id
      const owner = (await on.signIn('owner@example.com', 'teach')).token
      const profile = await on.api('GET', `/api/teach/profiles/${id}/profile`, { token: owner })
      expect(profile.body.profile.classesEnabled).toBe(true)
    } finally {
      await on.close()
    }
  })
})
