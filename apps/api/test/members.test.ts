import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Goal 9: an owner can add a writer without sharing a login. Invitations, acceptance, the
 * manager confirmation step, the sending limit, and who may remove or change whom.
 */
let t: TestApp
/** An approved personal profile, owned by owner@example.com. */
let personal: string
/** An approved corporate profile, owned by boss@example.com. */
let company: string
let owner: string
let boss: string

const DAY = 24 * 60 * 60 * 1000

const profile = (profileId: string, path: string) => `/api/teach/profiles/${profileId}${path}`
const tokenOf = (link: string) => link.split('/').pop() as string
const signIn = async (email: string) => (await t.signIn(email, 'teach')).token as string

async function invite(
  profileId: string,
  as: string,
  email: string,
  role: 'writer' | 'manager' = 'writer',
) {
  const res = await t.api('POST', profile(profileId, '/invitations'), {
    token: as,
    body: { email, role },
  })
  return {
    status: res.status,
    body: res.body,
    id: res.body?.invitation?.id as string,
    token: res.body?.dev?.link ? tokenOf(res.body.dev.link) : '',
  }
}

const accept = (token: string, as: string) =>
  t.api('POST', `/api/teach/invitations/${token}/accept`, { token: as })

const membersOf = async (profileId: string, as: string) =>
  (await t.api('GET', profile(profileId, '/members'), { token: as })).body as {
    members: Array<{ userId: string; email: string; role: string; addedBy: string | null }>
    invitations: Array<{
      id: string
      email: string
      role: string
      status: string
      acceptedByEmail: string | null
    }>
  }

const mailTo = (to: string) => t.mailer.sent.filter((m) => m.to === to)

beforeAll(async () => {
  t = await createTestApp()
  personal = (await t.createProfile('owner@example.com', { displayName: 'Mei Lin Bakes' })).profile
    .id
  company = (
    await t.createProfile('boss@example.com', { displayName: 'Dough Co', type: 'corporate' })
  ).profile.id
  owner = await signIn('owner@example.com')
  boss = await signIn('boss@example.com')
})
afterAll(async () => {
  await t.close()
})

describe('inviting a writer', () => {
  it('lets someone with no account accept, edit a draft course, and nothing more', async () => {
    expect(await t.db.query.users.findFirst({ where: { email: 'helper@example.com' } })).toBe(
      undefined,
    )
    const sent = await invite(personal, owner, 'helper@example.com')
    expect(sent.status).toBe(200)
    expect(sent.body.invitation).toMatchObject({
      email: 'helper@example.com',
      role: 'writer',
      status: 'pending',
    })
    // the email carries the link, and the link opens the Teach invitation page
    const email = mailTo('helper@example.com').at(-1)
    expect(email?.subject).toContain('invited you to Mei Lin Bakes')
    expect(email?.text).toContain(`http://teach.test/invitations/${sent.token}`)
    // only a keyed hash of the token is stored
    const stored = await t.db.query.profileInvitations.findFirst({ where: { id: sent.id } })
    expect(stored?.tokenHash).not.toContain(sent.token)

    // the invitation page needs no sign-in
    const preview = await t.api('GET', `/api/teach/invitations/${sent.token}`)
    expect(preview.status).toBe(200)
    expect(preview.body.invitation).toMatchObject({
      profileName: 'Mei Lin Bakes',
      profileType: 'personal',
      role: 'writer',
      status: 'pending',
      invitedByName: 'owner@example.com',
    })
    // accepting does
    expect((await t.api('POST', `/api/teach/invitations/${sent.token}/accept`)).status).toBe(401)

    // signing in creates the account; accepting makes them a writer
    const helper = await signIn('helper@example.com')
    const accepted = await accept(sent.token, helper)
    expect(accepted.status).toBe(200)
    expect(accepted.body.accepted).toEqual({
      profileId: personal,
      profileName: 'Mei Lin Bakes',
      role: 'writer',
      status: 'accepted',
    })
    const me = await t.api('GET', '/api/auth/me', { token: helper })
    expect(me.body.user.profiles).toEqual([
      {
        id: personal,
        type: 'personal',
        displayName: 'Mei Lin Bakes',
        status: 'approved',
        role: 'writer',
      },
    ])
    // the owner is told
    expect(mailTo('owner@example.com').at(-1)?.subject).toBe(
      'helper@example.com joined Mei Lin Bakes as a writer',
    )
    const list = await membersOf(personal, owner)
    expect(list.members).toMatchObject([
      { email: 'helper@example.com', role: 'writer', addedBy: 'owner@example.com' },
    ])
    expect(list.invitations).toEqual([])

    // the writer creates and edits a draft course
    const created = await t.api('POST', profile(personal, '/courses'), {
      token: helper,
      body: { title: 'Helper writes a course', category: 'craft-making' },
    })
    expect(created.status).toBe(200)
    const courseId = created.body.course.id as string
    const lesson = await t.api('POST', profile(personal, `/courses/${courseId}/lessons`), {
      token: helper,
      body: { title: 'Written by the helper' },
    })
    expect(lesson.status).toBe(200)
    const details = await t.api('PATCH', profile(personal, `/courses/${courseId}`), {
      token: helper,
      body: { summary: 'A draft course can have its details edited by a writer.' },
    })
    expect(details.status).toBe(200)

    // and is refused on money, publishing, members and Stripe
    const refused: Array<[string, string, unknown?]> = [
      ['PUT', `/courses/${courseId}/price`, { priceCents: 100 }],
      ['POST', `/courses/${courseId}/submit`],
      ['DELETE', `/courses/${courseId}`],
      ['GET', '/earnings'],
      ['GET', '/members'],
      ['POST', '/invitations', { email: 'friend@example.com', role: 'writer' }],
      ['POST', '/stripe/onboarding-link'],
      ['POST', '/stripe/login-link'],
      ['PATCH', '/profile', { headline: 'A headline that is long enough' }],
    ]
    for (const [method, path, body] of refused) {
      const res = await t.api(method, profile(personal, path), { token: helper, body })
      expect(res.status, `${method} ${path}`).toBe(403)
    }
  })

  it('works the same for someone who already has an account', async () => {
    await t.ensureUser('regular@example.com', 'Reggie')
    const regular = await signIn('regular@example.com')
    const sent = await invite(personal, owner, 'regular@example.com')
    const accepted = await accept(sent.token, regular)
    expect(accepted.body.accepted).toMatchObject({ role: 'writer', status: 'accepted' })
    expect(mailTo('owner@example.com').at(-1)?.subject).toBe(
      'Reggie joined Mei Lin Bakes as a writer',
    )
  })

  it('lets a writer invitation be accepted from another address, and says so to the owner', async () => {
    const sent = await invite(personal, owner, 'work@example.com')
    const other = await signIn('home@example.com')
    const accepted = await accept(sent.token, other)
    expect(accepted.body.accepted.status).toBe('accepted')
    const note = mailTo('owner@example.com').at(-1)
    expect(note?.text).toContain('home@example.com')
    expect(note?.text).toContain('work@example.com')
  })

  it('refuses the owner, a member, and someone who has already used the link', async () => {
    expect((await invite(personal, owner, 'owner@example.com')).body.error.code).toBe(
      'already_owner',
    )
    expect((await invite(personal, owner, 'helper@example.com')).body.error.code).toBe(
      'already_member',
    )
    const sent = await invite(personal, owner, 'another@example.com')
    // the owner and an existing member cannot take someone else's link either
    expect((await accept(sent.token, owner)).body.error.code).toBe('already_owner')
    const helper = await signIn('helper@example.com')
    expect((await accept(sent.token, helper)).body.error.code).toBe('already_member')
    const another = await signIn('another@example.com')
    expect((await accept(sent.token, another)).status).toBe(200)
    const late = await signIn('late@example.com')
    const again = await accept(sent.token, late)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('invitation_accepted')
    expect((await accept('not-a-real-token-not-a-real-token', late)).status).toBe(404)
  })
})

describe('the invitation email', () => {
  it('shows a name or a profile name as text, never as markup', async () => {
    const markup = '<a href="https://example.org/steal">Verify your account</a>'
    await t.ensureUser('mallory@example.com', markup)
    const { profile: theirs } = await t.createProfile('mallory@example.com', {
      displayName: 'Bakes & <b>Cakes</b>',
    })
    const mallory = await signIn('mallory@example.com')
    const sent = await invite(theirs.id, mallory, 'target@example.com')
    expect(sent.status).toBe(200)
    const email = mailTo('target@example.com').at(-1)
    expect(email?.html).not.toContain('<a href="https://example.org/steal"')
    expect(email?.html).not.toContain('<b>Cakes</b>')
    expect(email?.html).toContain('&lt;a href=&quot;https://example.org/steal&quot;&gt;')
    expect(email?.html).toContain('Bakes &amp; &lt;b&gt;Cakes&lt;/b&gt;')
    // the one link in the email is the invitation itself
    const links = [...(email?.html ?? '').matchAll(/<a href="([^"]+)"/g)].map((m) => m[1])
    expect(links).toEqual([`http://teach.test/invitations/${sent.token}`])
    // the plain-text part needs no escaping
    expect(email?.text).toContain('Bakes & <b>Cakes</b>')
  })
})

describe('managers', () => {
  it('are refused on a personal profile', async () => {
    const sent = await invite(personal, owner, 'deputy@example.com', 'manager')
    expect(sent.status).toBe(409)
    expect(sent.body.error.code).toBe('managers_corporate_only')
  })

  it('join at once when they accept from the invited address', async () => {
    const sent = await invite(company, boss, 'ops@example.com', 'manager')
    expect(sent.status).toBe(200)
    const ops = await signIn('ops@example.com')
    expect((await accept(sent.token, ops)).body.accepted).toMatchObject({
      role: 'manager',
      status: 'accepted',
    })
    expect((await membersOf(company, ops)).members).toMatchObject([
      { email: 'ops@example.com', role: 'manager' },
    ])
  })

  it('wait for the owner to confirm when they accept from another address', async () => {
    const sent = await invite(company, boss, 'finance@example.com', 'manager')
    const personalAddress = await signIn('finance.personal@example.com')
    const accepted = await accept(sent.token, personalAddress)
    expect(accepted.status).toBe(200)
    expect(accepted.body.accepted.status).toBe('awaiting_confirmation')

    // not a member yet
    expect(
      (await t.api('GET', profile(company, '/profile'), { token: personalAddress })).status,
    ).toBe(404)
    const ask = mailTo('boss@example.com').at(-1)
    expect(ask?.subject).toBe('Confirm finance.personal@example.com as a manager of Dough Co')
    const waiting = (await membersOf(company, boss)).invitations
    expect(waiting).toMatchObject([
      {
        id: sent.id,
        email: 'finance@example.com',
        role: 'manager',
        status: 'awaiting_confirmation',
        acceptedByEmail: 'finance.personal@example.com',
      },
    ])

    // a manager cannot confirm another manager; the owner can
    const ops = await signIn('ops@example.com')
    const byManager = await t.api('POST', profile(company, `/invitations/${sent.id}/confirm`), {
      token: ops,
    })
    expect(byManager.status).toBe(403)
    const confirmed = await t.api('POST', profile(company, `/invitations/${sent.id}/confirm`), {
      token: boss,
    })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.members.map((m: { email: string }) => m.email)).toContain(
      'finance.personal@example.com',
    )
    expect(confirmed.body.invitations).toEqual([])
    expect(
      (await t.api('GET', profile(company, '/profile'), { token: personalAddress })).status,
    ).toBe(200)
    expect(mailTo('finance.personal@example.com').at(-1)?.subject).toBe(
      'You are now a manager of Dough Co',
    )
    // confirming twice is refused
    const twice = await t.api('POST', profile(company, `/invitations/${sent.id}/confirm`), {
      token: boss,
    })
    expect(twice.body.error.code).toBe('invitation_not_awaiting')
  })

  it('invite and remove writers, but not managers', async () => {
    const ops = await signIn('ops@example.com')
    const writer = await invite(company, ops, 'pen@example.com')
    expect(writer.status).toBe(200)
    expect((await invite(company, ops, 'second@example.com', 'manager')).status).toBe(403)
    const pen = await signIn('pen@example.com')
    await accept(writer.token, pen)
    // sent by a manager, so the owner hears about it as well as the manager
    expect(mailTo('ops@example.com').at(-1)?.subject).toContain('joined Dough Co as a writer')
    expect(mailTo('boss@example.com').at(-1)?.subject).toContain('joined Dough Co as a writer')

    const list = await membersOf(company, boss)
    const idOf = (email: string) => list.members.find((m) => m.email === email)?.userId
    // a manager cannot remove another manager
    const other = await t.api(
      'DELETE',
      profile(company, `/members/${idOf('finance.personal@example.com')}`),
      {
        token: ops,
      },
    )
    expect(other.status).toBe(403)
    // a manager cannot revoke or resend a manager invitation either
    const pendingManager = await invite(company, boss, 'third@example.com', 'manager')
    for (const [method, path] of [
      ['DELETE', `/invitations/${pendingManager.id}`],
      ['POST', `/invitations/${pendingManager.id}/resend`],
    ] as const) {
      expect((await t.api(method, profile(company, path), { token: ops })).status).toBe(403)
    }
    // a manager removes a writer
    const removed = await t.api('DELETE', profile(company, `/members/${idOf('pen@example.com')}`), {
      token: ops,
    })
    expect(removed.status).toBe(200)
    expect((await t.api('GET', profile(company, '/profile'), { token: pen })).status).toBe(404)
    // the owner removes a manager
    const gone = await t.api(
      'DELETE',
      profile(company, `/members/${idOf('finance.personal@example.com')}`),
      {
        token: boss,
      },
    )
    expect(gone.status).toBe(200)
    expect(gone.body.members.map((m: { email: string }) => m.email)).toEqual(['ops@example.com'])
  })

  it('are made from writers, and back, by the owner alone', async () => {
    const quill = await t.addMember(company, 'quill@example.com', 'writer')
    const ops = await signIn('ops@example.com')
    const path = profile(company, `/members/${quill.id}`)
    expect((await t.api('PATCH', path, { token: ops, body: { role: 'manager' } })).status).toBe(403)

    const up = await t.api('PATCH', path, { token: boss, body: { role: 'manager' } })
    expect(up.status).toBe(200)
    expect(
      up.body.members.find((m: { email: string }) => m.email === 'quill@example.com'),
    ).toMatchObject({
      role: 'manager',
    })
    expect(mailTo('quill@example.com').at(-1)?.subject).toBe('You are now a manager of Dough Co')
    const down = await t.api('PATCH', path, { token: boss, body: { role: 'writer' } })
    expect(
      down.body.members.find((m: { email: string }) => m.email === 'quill@example.com'),
    ).toMatchObject({
      role: 'writer',
    })
    const audit = await t.db.query.auditLog.findMany({
      where: { action: 'member.role', profileId: company },
      orderBy: { createdAt: 'asc' },
    })
    expect(audit.map((a) => a.metadata)).toMatchObject([
      { from: 'writer', to: 'manager' },
      { from: 'manager', to: 'writer' },
    ])

    // a personal profile has no manager role to change to
    const helper = await t.db.query.users.findFirst({ where: { email: 'helper@example.com' } })
    const onPersonal = await t.api('PATCH', profile(personal, `/members/${helper?.id}`), {
      token: owner,
      body: { role: 'manager' },
    })
    expect(onPersonal.status).toBe(409)
    expect(onPersonal.body.error.code).toBe('managers_corporate_only')
    // and someone who is not a member is not found
    const stranger = await t.ensureUser('nobody@example.com')
    const missing = await t.api('PATCH', profile(company, `/members/${stranger.id}`), {
      token: boss,
      body: { role: 'manager' },
    })
    expect(missing.status).toBe(404)
  })
})

describe('an invitation link', () => {
  it('stops working when the invitation is sent again', async () => {
    const first = await invite(personal, owner, 'again@example.com')
    const second = await t.api('POST', profile(personal, `/invitations/${first.id}/resend`), {
      token: owner,
    })
    expect(second.status).toBe(200)
    const newToken = tokenOf(second.body.dev.link)
    expect(newToken).not.toBe(first.token)
    expect(second.body.invitation.id).not.toBe(first.id)

    const invitee = await signIn('again@example.com')
    const old = await accept(first.token, invitee)
    expect(old.status).toBe(409)
    expect(old.body.error.code).toBe('invitation_revoked')
    expect(
      (await t.api('GET', `/api/teach/invitations/${first.token}`)).body.invitation.status,
    ).toBe('revoked')
    expect((await accept(newToken, invitee)).status).toBe(200)
  })

  it('is replaced when the same address is invited again while still pending', async () => {
    const first = await invite(personal, owner, 'twice@example.com')
    const second = await invite(personal, owner, 'twice@example.com')
    expect(second.status).toBe(200)
    expect(second.id).not.toBe(first.id)
    const pending = (await membersOf(personal, owner)).invitations.filter(
      (i) => i.email === 'twice@example.com',
    )
    expect(pending.map((i) => i.id)).toEqual([second.id])
    const invitee = await signIn('twice@example.com')
    expect((await accept(first.token, invitee)).body.error.code).toBe('invitation_revoked')

    // a different role is not a resend: the pending one has to be revoked first
    const pendingWriter = await invite(company, boss, 'either@example.com')
    const asManager = await invite(company, boss, 'either@example.com', 'manager')
    expect(asManager.status).toBe(409)
    expect(asManager.body.error.code).toBe('invitation_pending')
    await t.api('DELETE', profile(company, `/invitations/${pendingWriter.id}`), { token: boss })
    expect((await invite(company, boss, 'either@example.com', 'manager')).status).toBe(200)
  })

  it('stops working when it is revoked', async () => {
    const sent = await invite(personal, owner, 'changed.mind@example.com')
    const revoked = await t.api('DELETE', profile(personal, `/invitations/${sent.id}`), {
      token: owner,
    })
    expect(revoked.status).toBe(200)
    expect(
      revoked.body.invitations.some((i: { id: string }) => i.id === sent.id),
      'a revoked invitation is no longer listed',
    ).toBe(false)
    const invitee = await signIn('changed.mind@example.com')
    const res = await accept(sent.token, invitee)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('invitation_revoked')
    // revoking twice is refused
    const twice = await t.api('DELETE', profile(personal, `/invitations/${sent.id}`), {
      token: owner,
    })
    expect(twice.body.error.code).toBe('invitation_revoked')
  })

  it('expires after 7 days, and an expired one does not block a new invitation', async () => {
    const sent = await invite(personal, owner, 'slow@example.com')
    const invitee = await signIn('slow@example.com')
    t.advanceClock(7 * DAY + 60_000)
    const late = await accept(sent.token, invitee)
    expect(late.status).toBe(409)
    expect(late.body.error.code).toBe('invitation_expired')
    const stored = await t.db.query.profileInvitations.findFirst({ where: { id: sent.id } })
    expect(stored?.status).toBe('expired')
    // sessions made before the clock moved are a week old now; sign in again
    const ownerNow = await signIn('owner@example.com')
    expect(
      (await membersOf(personal, ownerNow)).invitations.some((i) => i.id === sent.id),
      'an expired invitation is no longer listed',
    ).toBe(false)
    const fresh = await invite(personal, ownerNow, 'slow@example.com')
    expect(fresh.status).toBe(200)
    expect((await accept(fresh.token, await signIn('slow@example.com'))).status).toBe(200)
  })
})

describe('the sending limit', () => {
  it('refuses the 21st invitation in 24 hours, resends included, and lifts as the day passes', async () => {
    const { profile: busy } = await t.createProfile('busy@example.com', { displayName: 'Busy' })
    const token = await signIn('busy@example.com')
    for (let n = 1; n <= 18; n++) {
      const sent = await invite(busy.id, token, `invitee${n}@example.com`)
      expect(sent.status, `invitation ${n}`).toBe(200)
    }
    // a resend and a repeat invitation count: 19 and 20
    const last = await invite(busy.id, token, 'invitee19@example.com')
    expect(last.status).toBe(200)
    const repeat = await invite(busy.id, token, 'invitee19@example.com')
    expect(repeat.status).toBe(200)
    const over = await invite(busy.id, token, 'invitee21@example.com')
    expect(over.status).toBe(429)
    const resend = await t.api('POST', profile(busy.id, `/invitations/${repeat.id}/resend`), {
      token,
    })
    expect(resend.status).toBe(429)
    // another profile is not affected
    expect((await invite(company, boss, 'unrelated@example.com')).status).toBe(200)

    t.advanceClock(DAY + 1000)
    expect((await invite(busy.id, token, 'invitee21@example.com')).status).toBe(200)
  })
})

describe('leaving and profiles that are not approved', () => {
  it('lets a writer leave; the owner cannot', async () => {
    await t.addMember(personal, 'leaver@example.com', 'writer')
    const leaver = await signIn('leaver@example.com')
    expect((await t.api('GET', profile(personal, '/profile'), { token: leaver })).status).toBe(200)
    const left = await t.api('DELETE', profile(personal, '/members/me'), { token: leaver })
    expect(left.status).toBe(200)
    expect((await t.api('GET', profile(personal, '/profile'), { token: leaver })).status).toBe(404)

    const ownerNow = await signIn('owner@example.com')
    const stay = await t.api('DELETE', profile(personal, '/members/me'), { token: ownerNow })
    expect(stay.status).toBe(409)
    expect(stay.body.error.code).toBe('owner_cannot_leave')
    // staff act inside a profile without belonging to it
    await t.grantRole('root@example.com', 'super_admin')
    const root = await signIn('root@example.com')
    expect((await t.api('DELETE', profile(personal, '/members/me'), { token: root })).status).toBe(
      404,
    )
  })

  it('refuses every member route on a profile that is awaiting approval', async () => {
    const { profile: applied } = await t.createProfile('applicant@example.com', {
      status: 'applied',
    })
    const applicant = await signIn('applicant@example.com')
    const stranger = await t.ensureUser('someone@example.com')
    const calls: Array<[string, string, unknown?]> = [
      ['GET', '/members'],
      ['POST', '/invitations', { email: 'helper2@example.com', role: 'writer' }],
      ['DELETE', `/members/${stranger.id}`],
      ['PATCH', `/members/${stranger.id}`, { role: 'writer' }],
    ]
    for (const [method, path, body] of calls) {
      const res = await t.api(method, profile(applied.id, path), { token: applicant, body })
      expect(res.status, `${method} ${path}`).toBe(403)
    }
    expect(
      await t.db.query.profileInvitations.findFirst({ where: { profileId: applied.id } }),
    ).toBe(undefined)
  })
})

describe('a member of two profiles (CUJ 6)', () => {
  it('acts on the profile named in the URL, with the role they hold there', async () => {
    // owner@example.com owns `personal` and writes for `company`
    await t.addMember(company, 'owner@example.com', 'writer')
    const both = await signIn('owner@example.com')
    const me = await t.api('GET', '/api/auth/me', { token: both })
    expect(me.body.user.profiles.map((p: { id: string; role: string }) => [p.id, p.role])).toEqual([
      [personal, 'owner'],
      [company, 'writer'],
    ])

    // the same request lands on whichever profile the URL names
    const mine = await t.api('POST', profile(personal, '/courses'), {
      token: both,
      body: { title: 'Saved from the first tab', category: 'craft-making' },
    })
    const theirs = await t.api('POST', profile(company, '/courses'), {
      token: both,
      body: { title: 'Saved from the second tab', category: 'craft-making' },
    })
    expect(mine.body.course.profile.id).toBe(personal)
    expect(theirs.body.course.profile.id).toBe(company)

    // owner rights on one profile give nothing on the other
    expect((await t.api('GET', profile(personal, '/earnings'), { token: both })).status).toBe(200)
    expect((await t.api('GET', profile(personal, '/members'), { token: both })).status).toBe(200)
    expect((await t.api('GET', profile(company, '/earnings'), { token: both })).status).toBe(403)
    expect((await t.api('GET', profile(company, '/members'), { token: both })).status).toBe(403)
    // a course of one profile is not found through the other's URL
    const crossed = await t.api('GET', profile(company, `/courses/${mine.body.course.id}`), {
      token: both,
    })
    expect(crossed.status).toBe(404)
  })
})
