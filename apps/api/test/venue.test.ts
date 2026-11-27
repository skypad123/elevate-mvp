import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { qrSvg } from '../src/lib/class-code'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The venue position and the code screen (docs/designs/scheduled-classes-attendance.md, "The
 * rotating code"): no code for an in-person class until the venue is set; a poor reading needs
 * confirming; a remote class needs no venue.
 */
let t: TestApp
let profileId: string
let courseId: string
let owner: string

beforeAll(async () => {
  t = await createTestApp()
  profileId = (await t.createProfile('owner@example.com')).profile.id
  courseId = (await t.createCourse(profileId, { status: 'live' })).courseId
  owner = (await t.signIn('owner@example.com', 'teach')).token as string
})
afterAll(async () => {
  await t.close()
})

const classPath = (classId: string) => `/api/teach/profiles/${profileId}/classes/${classId}`

describe('the venue position', () => {
  it('holds back the code until the venue is set', async () => {
    const c = await t.createClass(profileId, courseId, { venue: null })
    const code = `${classPath(c.classId)}/blocks/${c.blockId}/code`
    const refused = await t.api('GET', code, { token: owner })
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('venue_not_set')

    const set = await t.api('PUT', `${classPath(c.classId)}/venue-location`, {
      token: owner,
      body: { lat: 1.3, lng: 103.8, accuracyM: 25 },
    })
    expect(set.status).toBe(200)
    expect(set.body.class.venue).toMatchObject({
      lat: 1.3,
      lng: 103.8,
      accuracyM: 25,
      radiusM: 200,
      setAt: t.now().toISOString(),
    })
    const shown = await t.api('GET', code, { token: owner })
    expect(shown.status).toBe(200)
    const codes = shown.body.code.codes
    expect(codes).toHaveLength(3)
    expect(codes.map((x: { typed: string }) => x.typed.length)).toEqual([6, 6, 6])
    expect(new Set(codes.map((x: { typed: string }) => x.typed)).size).toBe(3)
    expect(codes[0].typed).toBe(await t.validCodeFor(c.blockId))
    expect(codes[0].qrSvg).toContain('<svg')
    // the test clock sits on a period boundary
    expect(codes.map((x: { startsInMs: number }) => x.startsInMs)).toEqual([0, 60_000, 120_000])
    expect(codes.map((x: { endsInMs: number }) => x.endsInMs)).toEqual([60_000, 120_000, 180_000])
    expect(JSON.stringify(shown.body)).not.toContain('codeSecret')

    const audit = await t.db.query.auditLog.findMany({
      where: { action: 'class.venue_set', entityId: c.classId },
    })
    expect(audit).toHaveLength(1)
    expect(audit[0]?.metadata).toEqual({ accuracyM: 25 })
  })

  it('asks to confirm a reading worse than 100 m', async () => {
    const c = await t.createClass(profileId, courseId, { venue: null })
    const path = `${classPath(c.classId)}/venue-location`
    const poor = await t.api('PUT', path, {
      token: owner,
      body: { lat: 1.3, lng: 103.8, accuracyM: 150 },
    })
    expect(poor.status).toBe(422)
    expect(poor.body.error).toMatchObject({
      code: 'venue_accuracy_poor',
      details: { accuracyM: 150 },
    })
    expect(
      (await t.db.query.classes.findFirst({ where: { id: c.classId } }))?.venueSetAt,
    ).toBeNull()
    const confirmed = await t.api('PUT', path, {
      token: owner,
      body: { lat: 1.3, lng: 103.8, accuracyM: 150, confirmPoorAccuracy: true },
    })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.class.venue.accuracyM).toBe(150)
  })

  it('needs no venue for a remote class, and refuses one', async () => {
    const c = await t.createClass(profileId, courseId, { delivery: 'remote' })
    const shown = await t.api('GET', `${classPath(c.classId)}/blocks/${c.blockId}/code`, {
      token: owner,
    })
    expect(shown.status).toBe(200)
    const set = await t.api('PUT', `${classPath(c.classId)}/venue-location`, {
      token: owner,
      body: { lat: 1.3, lng: 103.8, accuracyM: 10 },
    })
    expect(set.status).toBe(409)
    expect(set.body.error.code).toBe('class_is_remote')
  })

  it('links the QR code to the learner check-in page with the link code', async () => {
    const c = await t.createClass(profileId, courseId)
    const shown = await t.api('GET', `${classPath(c.classId)}/blocks/${c.blockId}/code`, {
      token: owner,
    })
    const link = await t.validCodeFor(c.blockId, undefined, 'link')
    expect(link).toHaveLength(20)
    expect(link.startsWith(shown.body.code.codes[0].typed)).toBe(true)
    // The image is drawn from the learner web address, the block and the link code.
    expect(shown.body.code.codes[0].qrSvg).toBe(
      await qrSvg(`http://learner.test/class/check-in/${c.blockId}?c=${link}`),
    )
  })
})
