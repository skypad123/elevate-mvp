import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * CUJ 7 and section 11: Support recovers a profile whose owner can no longer sign in. A personal
 * profile's owner gets a new address; a corporate profile gets a new owner. `super_admin` only.
 */
let t: TestApp
let root: string

const recover = (profileId: string, token: string | undefined, body: unknown) =>
  t.api('POST', `/api/support/profiles/${profileId}/recover-owner`, { token, body })
const signIn = async (email: string, audience: 'teach' | 'support' = 'teach') =>
  (await t.signIn(email, audience)).token as string
const mailTo = (to: string) => t.mailer.sent.filter((m) => m.to === to)
const me = async (token: string) => t.api('GET', '/api/auth/me', { token })

/** A finished PDF upload: the company officer's authorisation, as Support uploads it. */
async function uploadPdf(token: string, kind: 'document' | 'image' = 'document') {
  const file =
    kind === 'document'
      ? { kind, filename: 'authorisation.pdf', mimeType: 'application/pdf' }
      : { kind, filename: 'photo.png', mimeType: 'image/png' }
  const created = await t.api('POST', '/api/media/uploads', {
    token,
    body: { ...file, sizeBytes: 10 },
  })
  const id = created.body.asset.id as string
  const row = await t.db.query.mediaAssets.findFirst({ where: { id } })
  await t.storage.put(row?.storageKey as string, new Uint8Array([1]), file.mimeType)
  await t.api('POST', `/api/media/assets/${id}/complete`, { token })
  return id
}

beforeAll(async () => {
  t = await createTestApp()
  await t.grantRole('root@example.com', 'super_admin')
  await t.grantRole('agent@example.com', 'support_agent')
  root = await signIn('root@example.com', 'support')
})
afterAll(async () => {
  await t.close()
})

describe('recovering a personal profile', () => {
  it('moves the owner to a new address: same account, old sessions ended', async () => {
    // the owner signed up the usual way, so the account has its email sign-in identity
    const oldSession = await signIn('lost@example.com')
    const { profile, user } = await t.createProfile('lost@example.com', {
      displayName: 'Lost Inbox',
    })
    expect((await me(oldSession)).status).toBe(200)

    const res = await recover(profile.id, root, { newEmail: 'Found@Example.com' })
    expect(res.status).toBe(200)
    expect(res.body.profile.owner).toMatchObject({ id: user.id, email: 'found@example.com' })

    // the account kept its ID; its address and its email sign-in identity both moved
    const row = await t.db.query.users.findFirst({ where: { id: user.id } })
    expect(row?.email).toBe('found@example.com')
    const identities = await t.db.query.identities.findMany({ where: { userId: user.id } })
    expect(identities.map((i) => i.providerSubject)).toEqual(['found@example.com'])
    // whoever held a session under the old address is signed out
    expect((await me(oldSession)).status).toBe(401)

    // the new address signs in to the same account, with its profile
    const newSession = await signIn('found@example.com')
    const now = await me(newSession)
    expect(now.body.user.id).toBe(user.id)
    expect(now.body.user.profiles).toMatchObject([{ id: profile.id, role: 'owner' }])
    // the old address is a stranger now: a new account with no profile
    const stranger = await me(await signIn('lost@example.com'))
    expect(stranger.body.user.id).not.toBe(user.id)
    expect(stranger.body.user.profiles).toEqual([])

    const audit = await t.db.query.auditLog.findMany({
      where: { profileId: profile.id, action: 'profile.recover_owner' },
    })
    expect(audit).toHaveLength(1)
    expect(audit[0]?.metadata).toMatchObject({
      kind: 'personal',
      userId: user.id,
      fromEmail: 'lost@example.com',
      toEmail: 'found@example.com',
    })
    // both addresses are told
    expect(mailTo('lost@example.com').some((m) => m.subject.includes('was changed'))).toBe(true)
    expect(
      mailTo('found@example.com').some((m) => m.subject.includes('sign in to Elevate with this')),
    ).toBe(true)
  })

  it('refuses an address that another account uses, and the address it already has', async () => {
    const { profile } = await t.createProfile('careful@example.com')
    await t.ensureUser('occupied@example.com')
    const taken = await recover(profile.id, root, { newEmail: 'occupied@example.com' })
    expect(taken.status).toBe(409)
    expect(taken.body.error.code).toBe('email_taken')
    const same = await recover(profile.id, root, { newEmail: 'careful@example.com' })
    expect(same.body.error.code).toBe('same_email')
    // a personal profile is not recovered by naming a new owner
    const wrong = await recover(profile.id, root, {
      newOwnerUserId: (await t.ensureUser('occupied@example.com')).id,
      authorisationMediaId: await uploadPdf(root),
      removePreviousOwner: false,
    })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.code).toBe('wrong_recovery')
    const row = await t.db.query.users.findFirst({ where: { email: 'careful@example.com' } })
    expect(row).toBeDefined()
  })
})

describe('recovering a corporate profile (CUJ 7)', () => {
  it('makes another user the owner and keeps the previous owner as a manager', async () => {
    const { profile, user: previous } = await t.createProfile('departed@example.com', {
      displayName: 'Dough Co',
      type: 'corporate',
    })
    // the person the company names is already on the profile, as a writer
    const next = await t.addMember(profile.id, 'successor@example.com', 'writer')
    const previousSession = await signIn('departed@example.com')
    const nextSession = await signIn('successor@example.com')
    const authorisation = await uploadPdf(root)

    const res = await recover(profile.id, root, {
      newOwnerUserId: next.id,
      authorisationMediaId: authorisation,
      removePreviousOwner: false,
    })
    expect(res.status).toBe(200)
    expect(res.body.profile.owner).toMatchObject({ id: next.id, email: 'successor@example.com' })

    // the owner is a column, never a member as well; the previous owner is now a manager
    const members = await t.db.query.profileMemberships.findMany({
      where: { profileId: profile.id },
    })
    expect(members.map((m) => [m.userId, m.role])).toEqual([[previous.id, 'manager']])
    // Support's page for each person shows the profile with their new role on it
    for (const [userId, role] of [
      [next.id, 'owner'],
      [previous.id, 'manager'],
    ] as const) {
      const person = await t.api('GET', `/api/support/people/${userId}`, { token: root })
      expect(person.body.person.profiles).toMatchObject([{ id: profile.id, role }])
    }
    // the previous owner is signed out; the new owner's session is kept and is now the owner's
    expect((await me(previousSession)).status).toBe(401)
    const now = await me(nextSession)
    expect(now.body.user.profiles).toMatchObject([{ id: profile.id, role: 'owner' }])
    const stripe = await t.api('POST', `/api/teach/profiles/${profile.id}/stripe/onboarding-link`, {
      token: nextSession,
    })
    expect(stripe.status).toBe(200)
    // signing in again, the previous owner is a manager: no Stripe links, no managing managers
    const again = await signIn('departed@example.com')
    expect((await me(again)).body.user.profiles).toMatchObject([
      { id: profile.id, role: 'manager' },
    ])
    const refused = await t.api(
      'POST',
      `/api/teach/profiles/${profile.id}/stripe/onboarding-link`,
      { token: again },
    )
    expect(refused.status).toBe(403)

    const audit = await t.db.query.auditLog.findMany({
      where: { profileId: profile.id, action: 'profile.recover_owner' },
    })
    expect(audit[0]?.metadata).toMatchObject({
      kind: 'corporate',
      fromUserId: previous.id,
      toUserId: next.id,
      authorisationMediaId: authorisation,
      previousOwnerKeptAsManager: true,
    })
    const toPrevious = mailTo('departed@example.com').find(
      (m) => m.subject === 'You are no longer the owner of Dough Co',
    )
    expect(toPrevious?.text).toContain('as a manager')
    expect(
      mailTo('successor@example.com').some(
        (m) => m.subject === 'You are now the owner of Dough Co',
      ),
    ).toBe(true)
  })

  it('removes the previous owner when the company asks for that', async () => {
    const { profile, user: previous } = await t.createProfile('gone@example.com', {
      displayName: 'Glaze Works',
      type: 'corporate',
    })
    const next = await t.ensureUser('newcomer@example.com')
    const res = await recover(profile.id, root, {
      newOwnerUserId: next.id,
      authorisationMediaId: await uploadPdf(root),
      removePreviousOwner: true,
    })
    expect(res.status).toBe(200)
    expect(
      await t.db.query.profileMemberships.findMany({ where: { profileId: profile.id } }),
    ).toEqual([])
    const again = await signIn('gone@example.com')
    expect((await me(again)).body.user.profiles).toEqual([])
    expect(
      (await t.api('GET', `/api/teach/profiles/${profile.id}/profile`, { token: again })).status,
    ).toBe(404)
    const notice = mailTo('gone@example.com').find((m) => m.subject.includes('no longer the owner'))
    expect(notice?.text).toContain('removed from the profile')
    expect(previous.id).not.toBe(next.id)
  })

  it('needs a real user, a different one, and an authorisation the admin uploaded', async () => {
    const { profile, user: owner } = await t.createProfile('steady@example.com', {
      type: 'corporate',
    })
    const next = await t.ensureUser('candidate@example.com')
    const authorisation = await uploadPdf(root)
    const body = {
      newOwnerUserId: next.id,
      authorisationMediaId: authorisation,
      removePreviousOwner: false,
    }

    const unknown = await recover(profile.id, root, {
      ...body,
      newOwnerUserId: '00000000-0000-4000-8000-000000000000',
    })
    expect(unknown.status).toBe(404)
    const same = await recover(profile.id, root, { ...body, newOwnerUserId: owner.id })
    expect(same.body.error.code).toBe('already_owner')
    // a file someone else uploaded, and a file that is not a PDF
    const theirs = await uploadPdf(await signIn('candidate@example.com'))
    expect(
      (await recover(profile.id, root, { ...body, authorisationMediaId: theirs })).status,
    ).toBe(404)
    const image = await uploadPdf(root, 'image')
    expect((await recover(profile.id, root, { ...body, authorisationMediaId: image })).status).toBe(
      400,
    )
    // a company profile is not recovered by changing an address
    const wrong = await recover(profile.id, root, { newEmail: 'new@example.com' })
    expect(wrong.body.error.code).toBe('wrong_recovery')

    const unchanged = await t.db.query.profiles.findFirst({ where: { id: profile.id } })
    expect(unchanged?.ownerUserId).toBe(owner.id)
    expect(
      await t.db.query.auditLog.findMany({
        where: { profileId: profile.id, action: 'profile.recover_owner' },
      }),
    ).toEqual([])
  })
})

describe('who may recover an owner', () => {
  it('is a super admin and nobody else', async () => {
    const { profile } = await t.createProfile('target@example.com')
    const body = { newEmail: 'taken-over@example.com' }
    const agent = await signIn('agent@example.com', 'support')
    const owner = await signIn('target@example.com')
    for (const token of [agent, owner]) {
      expect((await recover(profile.id, token, body)).status).toBe(403)
    }
    expect((await recover(profile.id, undefined, body)).status).toBe(401)
    const row = await t.db.query.users.findFirst({ where: { email: 'target@example.com' } })
    expect(row).toBeDefined()
    // the owner's session survived the refused attempts
    expect((await me(owner)).status).toBe(200)
  })
})
