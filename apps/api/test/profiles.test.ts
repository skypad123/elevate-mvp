import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let agent: string

const application = {
  displayName: 'Hana Sato',
  headline: 'Ikebana teacher and florist',
  bio: 'Fifteen years arranging flowers for hotels and eight years teaching the Sogetsu school to complete beginners.',
  credentials: 'Sogetsu teacher certificate, fourth grade. Runs a studio in Tiong Bahru.',
  teachingSampleUrl: 'https://example.com/ikebana',
}

beforeAll(async () => {
  t = await createTestApp()
  await t.grantRole('agent@example.com', 'support_agent')
  agent = (await t.signIn('agent@example.com', 'support')).token as string
})
afterAll(async () => {
  await t.close()
})

/** The database's own answer to a statement: resolves to the error message, or null if it ran. */
async function refusal(statement: Promise<unknown>): Promise<string | null> {
  try {
    await statement
    return null
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause
    return cause?.message ?? (error as Error).message
  }
}

describe('profiles', () => {
  it('gives a person one personal profile, however often they apply', async () => {
    const token = (await t.signIn('hana@example.com', 'teach')).token as string
    const first = await t.api('POST', '/api/teach/apply', { token, body: application })
    const second = await t.api('POST', '/api/teach/apply', {
      token,
      body: { ...application, headline: 'Ikebana teacher, florist and author' },
    })
    expect(second.status).toBe(200)
    expect(second.body.profile.id).toBe(first.body.profile.id)
    expect(second.body.profile.headline).toBe('Ikebana teacher, florist and author')

    const user = await t.ensureUser('hana@example.com')
    const rows = await t.db.query.profiles.findMany({ where: { ownerUserId: user.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'personal', status: 'applied' })

    // the database enforces it too, not only the service
    const duplicate = await refusal(
      t.db
        .insert(s.profiles)
        .values({ type: 'personal', ownerUserId: user.id, displayName: 'Second personal' }),
    )
    expect(duplicate).toContain('profiles_one_personal_per_owner')
  })

  it('lets one person own a corporate profile beside their personal one', async () => {
    const user = await t.ensureUser('hana@example.com')
    const added = await refusal(
      t.db
        .insert(s.profiles)
        .values({ type: 'corporate', ownerUserId: user.id, displayName: 'Hana Studio Pte Ltd' }),
    )
    expect(added).toBeNull()
    const token = (await t.signIn('hana@example.com', 'teach')).token as string
    const me = await t.api('GET', '/api/auth/me', { token })
    expect(me.body.user.profiles.map((p: { type: string }) => p.type)).toEqual([
      'personal',
      'corporate',
    ])
  })

  it('refuses a profile with no owner', async () => {
    const orphan = await refusal(
      t.db.insert(s.profiles).values({
        type: 'personal',
        displayName: 'Nobody',
        // The type forbids this; the cast is the point of the test.
        ownerUserId: null as unknown as string,
      }),
    )
    expect(orphan).toContain('owner_user_id')
    expect(orphan).toContain('null')
  })

  it('refuses to delete a user who owns a profile', async () => {
    const { user, profile } = await t.createProfile('owner-to-delete@example.com')
    const blocked = await refusal(t.db.delete(s.users).where(eq(s.users.id, user.id)))
    expect(blocked).toContain('profiles_owner_user_id_users_id_fkey')
    expect(await t.db.query.profiles.findFirst({ where: { id: profile.id } })).toBeTruthy()
    // a user who owns nothing can still be deleted
    const plain = await t.ensureUser('plain-learner@example.com')
    expect(await refusal(t.db.delete(s.users).where(eq(s.users.id, plain.id)))).toBeNull()
  })

  it('reopens a rejected profile on re-application and refuses once it is approved', async () => {
    const token = (await t.signIn('retry@example.com', 'teach')).token as string
    const applied = await t.api('POST', '/api/teach/apply', { token, body: application })
    const id: string = applied.body.profile.id
    await t.api('POST', `/api/support/profiles/${id}/reject`, {
      token: agent,
      body: { reason: 'Please link a longer teaching sample.' },
    })
    expect(t.mailer.last()?.html ?? t.mailer.last()?.text).toContain(`/p/${id}`)

    const again = await t.api('POST', '/api/teach/apply', {
      token,
      body: { ...application, teachingSampleUrl: 'https://example.com/longer-sample' },
    })
    expect(again.status).toBe(200)
    expect(again.body.profile).toMatchObject({
      id,
      status: 'applied',
      reviewNote: null,
      reviewedAt: null,
      teachingSampleUrl: 'https://example.com/longer-sample',
    })

    await t.api('POST', `/api/support/profiles/${id}/approve`, { token: agent, body: {} })
    const third = await t.api('POST', '/api/teach/apply', { token, body: application })
    expect(third.status).toBe(409)
    expect(third.body.error.code).toBe('profile_exists')
  })

  it('records a change of display name, with the old and new names', async () => {
    const { profile } = await t.createProfile('rename@example.com', { displayName: 'Old Name' })
    const token = (await t.signIn('rename@example.com', 'teach')).token as string
    const path = `/api/teach/profiles/${profile.id}/profile`
    const renamed = await t.api('PATCH', path, { token, body: { displayName: 'New Name' } })
    expect(renamed.status).toBe(200)
    expect(renamed.body.profile.displayName).toBe('New Name')
    // a change that leaves the name alone is not a rename
    await t.api('PATCH', path, { token, body: { headline: 'A headline long enough' } })
    const audit = await t.db.query.auditLog.findMany({ where: { profileId: profile.id } })
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      action: 'profile.rename',
      entityType: 'profile',
      entityId: profile.id,
      metadata: { from: 'Old Name', to: 'New Name' },
    })
  })
})
