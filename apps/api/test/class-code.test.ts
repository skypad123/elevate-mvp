import { CODE_PERIOD_MS, codePeriod } from '@elevate/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { codesFor, matchCode, newBlockSecret } from '../src/lib/class-code'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The rotating code (docs/designs/scheduled-classes-attendance.md, "The rotating code"): which
 * periods are accepted, which are expired, and that any API process can check any code.
 */
describe('matching a code', () => {
  const secret = newBlockSecret()
  const now = new Date('2026-11-08T04:00:30.000Z')
  const ago = (periods: number) => new Date(now.getTime() - periods * CODE_PERIOD_MS)
  const typedAt = (at: Date, key = secret) => codesFor(key, codePeriod(at)).typed

  it('accepts the current period and the one before', () => {
    expect(matchCode(secret, typedAt(now), now)).toEqual({
      kind: 'current',
      period: codePeriod(now),
    })
    expect(matchCode(secret, typedAt(ago(1)), now)).toEqual({
      kind: 'previous',
      period: codePeriod(now) - 1,
    })
    const link = codesFor(secret, codePeriod(now)).link
    expect(matchCode(secret, link, now).kind).toBe('current')
  })

  it('calls a code 2 to 11 periods old expired, and 12 periods old wrong', () => {
    for (let age = 2; age <= 11; age++) {
      expect(matchCode(secret, typedAt(ago(age)), now).kind, `${age} periods old`).toBe('expired')
    }
    expect(matchCode(secret, typedAt(ago(12)), now)).toEqual({ kind: 'none', period: null })
  })

  it('does not accept another block’s code, or a code of the wrong length', () => {
    expect(matchCode(secret, typedAt(now, newBlockSecret()), now).kind).toBe('none')
    expect(matchCode(secret, typedAt(now).slice(0, 5), now).kind).toBe('none')
  })

  it('gives a 6-character typed code that starts the 20-character link code', () => {
    const { typed, link } = codesFor(secret, 123)
    expect(typed).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/)
    expect(link).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{20}$/)
    expect(link.startsWith(typed)).toBe(true)
    expect(codesFor(secret, 123)).toEqual({ typed, link })
    expect(codesFor(secret, 124).typed).not.toBe(typed)
  })
})

describe('two API processes', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('accept each other’s codes, since both work them out from the stored secret', async () => {
    const profileId = (await t.createProfile('owner@example.com')).profile.id
    const courseId = (await t.createCourse(profileId, { status: 'live' })).courseId
    const { classId, blockId } = await t.createClass(profileId, courseId)
    const owner = (await t.signIn('owner@example.com', 'teach')).token
    const shown = await t.api(
      'GET',
      `/api/teach/profiles/${profileId}/classes/${classId}/blocks/${blockId}/code`,
      { token: owner },
    )
    expect(shown.status).toBe(200)

    await t.enrolInClass('learner@example.com', classId)
    const learner = (await t.signIn('learner@example.com')).token
    // a second app over the same database, as after a deploy, a minute later
    const second = createApp(t.deps)
    t.advanceClock(CODE_PERIOD_MS)
    const res = await second.request(`/api/me/classes/blocks/${blockId}/check-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${learner}` },
      body: JSON.stringify({
        code: shown.body.code.codes[0].typed,
        method: 'typed_code',
        platform: 'web',
        location: { status: 'denied' },
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { state: string } }
    expect(body.result.state).toBe('present_flagged')
  })
})
