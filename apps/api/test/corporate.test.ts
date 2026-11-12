import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Goals 13 and 14, and CUJ 4: a company applies on its own, Support reviews it once, the owner
 * completes company Stripe onboarding, Support confirms the legal name, and only then can the
 * company's courses be bought.
 */
let t: TestApp
let founder: string
let agent: string
/** The corporate profile the founder applies for in the first test. */
let company: string
let documentId: string

const UEN = '201912345K'
const teach = (path: string, profileId = company) => `/api/teach/profiles/${profileId}${path}`
const support = (path: string, profileId = company) => `/api/support/profiles/${profileId}${path}`
const signIn = async (email: string, audience: 'teach' | 'support' | 'learner' = 'teach') =>
  (await t.signIn(email, audience)).token as string
const mailTo = (to: string) => t.mailer.sent.filter((m) => m.to === to)

/** Uploads a file and finishes the upload, the way the browser does. */
async function upload(token: string, kind: 'document' | 'image' = 'document') {
  const file =
    kind === 'document'
      ? { kind, filename: 'business-profile.pdf', mimeType: 'application/pdf' }
      : { kind, filename: 'logo.png', mimeType: 'image/png' }
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

const application = (registryDocumentMediaId: string, overrides: Record<string, unknown> = {}) => ({
  uen: UEN,
  legalName: 'Kiln Collective Pte. Ltd.',
  entityType: 'private_limited',
  registryDocumentMediaId,
  displayName: 'Kiln Collective',
  headline: 'Ceramics classes by a working studio',
  bio: 'A studio in Jalan Bahar that has taught wheel throwing to beginners since 2019.',
  credentials: 'Founded 2019. Four resident potters. Over 600 students taught in studio.',
  teachingSampleUrl: 'https://example.com/a-class-on-video',
  ...overrides,
})

const payoutAccount = async (profileId = company) =>
  t.db.query.payoutAccounts.findFirst({ where: { profileId } })

async function checkout(courseId: string, email: string) {
  return t.api('POST', `/api/checkout/courses/${courseId}`, {
    token: await signIn(email, 'learner'),
    body: {},
  })
}

beforeAll(async () => {
  t = await createTestApp()
  await t.grantRole('agent@example.com', 'support_agent')
  founder = await signIn('founder@example.com')
  agent = await signIn('agent@example.com', 'support')
  documentId = await upload(founder)
})
afterAll(async () => {
  await t.close()
})

describe('a company applies (Goal 13)', () => {
  it('checks the UEN, the document and the teaching sample before anything is created', async () => {
    const send = (body: unknown) =>
      t.api('POST', '/api/teach/apply/corporate', { token: founder, body })
    const field = (res: { body: { error: { details: Array<{ path: string }> } } }) =>
      res.body.error.details.map((d) => d.path)

    const badUen = await send(application(documentId, { uen: '12345678A' }))
    expect(badUen.status).toBe(400)
    expect(field(badUen)).toEqual(['uen'])
    // a company's number is not an LLP's
    const wrongKind = await send(application(documentId, { entityType: 'llp' }))
    expect(field(wrongKind)).toEqual(['uen'])
    const noSample = await send(application(documentId, { teachingSampleUrl: undefined }))
    expect(field(noSample)).toEqual(['teachingSampleUrl'])

    // the registry document is a PDF that the applicant uploaded
    const image = await upload(founder, 'image')
    expect((await send(application(image))).status).toBe(400)
    const someoneElses = await upload(await signIn('other@example.com'))
    expect((await send(application(someoneElses))).status).toBe(404)

    expect(await t.db.query.legalEntities.findMany()).toEqual([])
    expect(await t.db.query.profiles.findMany()).toEqual([])
  })

  it('creates the profile and its legal entity together, waiting for review', async () => {
    const res = await t.api('POST', '/api/teach/apply/corporate', {
      token: founder,
      // typed in lower case with spaces around it
      body: application(documentId, { uen: ' 201912345k ' }),
    })
    expect(res.status).toBe(200)
    company = res.body.profile.id
    expect(res.body.profile).toMatchObject({
      type: 'corporate',
      status: 'applied',
      displayName: 'Kiln Collective',
      payout: null,
      legalEntity: {
        uen: UEN,
        legalName: 'Kiln Collective Pte. Ltd.',
        entityType: 'private_limited',
        checkStatus: 'pending',
        rejectionReason: null,
        registryDocumentMediaId: documentId,
      },
    })
    expect(mailTo('founder@example.com').at(-1)?.subject).toBe(
      'We received the Elevate Teach application for Kiln Collective Pte. Ltd.',
    )
    const me = await t.api('GET', '/api/auth/me', { token: founder })
    expect(me.body.user.profiles).toMatchObject([
      { id: company, type: 'corporate', status: 'applied', role: 'owner' },
    ])

    // the same person can also have a personal profile: the two are separate applications
    const personal = await t.api('POST', '/api/teach/apply', {
      token: founder,
      body: {
        displayName: 'Founder Fong',
        headline: 'Potter and studio founder',
        bio: 'Founder of a ceramics studio, teaching beginners how to centre clay since 2015.',
        credentials: 'Diploma in ceramics. Ten years of studio teaching.',
        teachingSampleUrl: 'https://example.com/founder-teaching',
      },
    })
    expect(personal.status).toBe(200)
    expect(personal.body.profile).toMatchObject({ type: 'personal', legalEntity: null })
  })

  it('shows Support the application with its type, its company and the registry document', async () => {
    const queue = await t.api('GET', '/api/support/profiles?status=applied', { token: agent })
    const byType = Object.fromEntries(queue.body.items.map((i: { type: string }) => [i.type, i]))
    expect(queue.body.items).toHaveLength(2)
    expect(byType.personal).toMatchObject({ uen: null, legalName: null })
    expect(byType.corporate).toMatchObject({
      id: company,
      uen: UEN,
      legalName: 'Kiln Collective Pte. Ltd.',
    })
    // a company is found by its UEN and by its legal name
    for (const q of ['201912345', 'kiln collective pte']) {
      const found = await t.api('GET', `/api/support/profiles?q=${encodeURIComponent(q)}`, {
        token: agent,
      })
      expect(
        found.body.items.map((i: { id: string }) => i.id),
        q,
      ).toEqual([company])
    }
    const detail = await t.api('GET', support(''), { token: agent })
    expect(detail.body.legalEntity).toMatchObject({
      uen: UEN,
      checkStatus: 'pending',
      checkedBy: null,
      registryDocument: { id: documentId, kind: 'document', status: 'ready' },
    })
  })

  it('refuses a UEN that another profile already holds', async () => {
    const rival = await signIn('rival@example.com')
    const res = await t.api('POST', '/api/teach/apply/corporate', {
      token: rival,
      body: application(await upload(rival), { legalName: 'Another Company Pte. Ltd.' }),
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('uen_in_use')
  })

  it('lets the applicant read the registry document only until the review, and Support always', async () => {
    const read = async (token: string) =>
      (await t.api('GET', `/api/media/assets/${documentId}/playback`, { token })).status
    expect(await read(founder)).toBe(200)
    expect(await read(agent)).toBe(200)
    expect(await read(await signIn('other@example.com'))).toBe(403)
  })
})

describe('the review', () => {
  it('rejects the profile and its company together, with the reason', async () => {
    const reason = 'The legal name on the application does not match the business profile.'
    const res = await t.api('POST', support('/reject'), { token: agent, body: { reason } })
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({
      status: 'rejected',
      reviewNote: reason,
      legalEntity: { checkStatus: 'rejected', rejectionReason: reason },
    })
    const detail = await t.api('GET', support(''), { token: agent })
    expect(detail.body.legalEntity).toMatchObject({
      checkStatus: 'rejected',
      checkedBy: 'agent@example.com',
    })
    // after the decision the document is for Support alone
    const founderReads = await t.api('GET', `/api/media/assets/${documentId}`, { token: founder })
    expect(founderReads.status).toBe(403)
    // the UEN stays with the rejected profile
    const rival = await signIn('rival@example.com')
    const again = await t.api('POST', '/api/teach/apply/corporate', {
      token: rival,
      body: application(await upload(rival)),
    })
    expect(again.body.error.code).toBe('uen_in_use')
  })

  it('lets the owner resubmit, which puts the application back in the queue', async () => {
    const resubmit = (token: string, body: unknown) =>
      t.api('PUT', teach('/apply/corporate'), { token, body })
    // someone outside the profile cannot, and platform staff acting in Teach cannot
    const rival = await signIn('rival@example.com')
    expect((await resubmit(rival, application(await upload(rival)))).status).toBe(404)
    await t.grantRole('root@example.com', 'super_admin')
    const root = await signIn('root@example.com')
    expect((await resubmit(root, application(await upload(root)))).status).toBe(403)

    // a UEN that belongs to another profile cannot be taken on the way
    const other = await t.createProfile('elsewhere@example.com', { type: 'corporate' })
    const theirs = await t.db.query.legalEntities.findFirst({
      where: { id: other.profile.legalEntityId as string },
    })
    const taken = await resubmit(founder, application(documentId, { uen: theirs?.uen }))
    expect(taken.body.error.code).toBe('uen_in_use')

    const newDocument = await upload(founder)
    const res = await resubmit(
      founder,
      application(newDocument, { legalName: 'Kiln Collective Private Limited' }),
    )
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({
      id: company,
      status: 'applied',
      reviewNote: null,
      legalEntity: {
        uen: UEN,
        legalName: 'Kiln Collective Private Limited',
        checkStatus: 'pending',
        rejectionReason: null,
        registryDocumentMediaId: newDocument,
      },
    })
    const queue = await t.api('GET', '/api/support/profiles?status=applied&type=corporate', {
      token: agent,
    })
    expect(queue.body.items.map((i: { id: string }) => i.id)).toEqual([company])
    // the earlier rejection, with its reason, is still on record
    const audit = await t.db.query.auditLog.findMany({
      where: { profileId: company, action: 'profile.reject' },
    })
    expect(audit.map((a) => a.metadata)).toMatchObject([
      { reason: 'The legal name on the application does not match the business profile.' },
    ])
    // the new document is the applicant's to read again while it waits
    expect(
      (await t.api('GET', `/api/media/assets/${newDocument}`, { token: founder })).status,
    ).toBe(200)
  })

  it('approves the profile and verifies its company in one decision', async () => {
    const res = await t.api('POST', support('/approve'), { token: agent, body: {} })
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({
      status: 'approved',
      legalEntity: { checkStatus: 'verified', rejectionReason: null },
    })
    const detail = await t.api('GET', support(''), { token: agent })
    expect(detail.body.legalEntity).toMatchObject({ checkedBy: 'agent@example.com' })
    expect(detail.body.legalEntity.checkedAt).toEqual(expect.any(String))
    const welcome = mailTo('founder@example.com').at(-1)
    expect(welcome?.subject).toBe('Welcome to Elevate Teach')
    expect(welcome?.text).toContain('Kiln Collective Private Limited')
    // an approved application cannot be resubmitted
    const late = await t.api('PUT', teach('/apply/corporate'), {
      token: founder,
      body: application(documentId),
    })
    expect(late.body.error.code).toBe('already_approved')
  })
})

describe('no company sells before both checks pass (Goal 14, CUJ 4)', () => {
  let courseId: string
  let stripeAccountId: string

  it('opens a company Stripe account, which stays onboarding when Stripe enables charges', async () => {
    courseId = (await t.createCourse(company, { status: 'live' })).courseId
    const link = await t.api('POST', teach('/stripe/onboarding-link'), { token: founder })
    expect(link.status).toBe(200)
    const account = await payoutAccount()
    stripeAccountId = account?.stripeAccountId as string
    expect(account).toMatchObject({ businessType: 'company', status: 'onboarding' })
    expect(t.payments.accounts.get(stripeAccountId)?.businessType).toBe('company')

    // Stripe finishes onboarding and enables charges: the webhook does not activate the account
    const hook = await t.stripeWebhook(t.payments.enableAccount(stripeAccountId))
    expect(hook.body.outcome).toBe('applied')
    expect(await payoutAccount()).toMatchObject({ status: 'onboarding', chargesEnabled: true })
    // and neither does the status poll
    const status = await t.api('GET', teach('/stripe/status'), { token: founder })
    expect(status.body.stripe).toMatchObject({
      status: 'onboarding',
      businessType: 'company',
      chargesEnabled: true,
      nameVerified: false,
    })
    const refused = await checkout(courseId, 'buyer-one@example.com')
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('teacher_not_payable')
  })

  it('shows Support the two legal names side by side', async () => {
    t.payments.setLegalName(stripeAccountId, 'KILN COLLECTIVE PRIVATE LIMITED')
    const res = await t.api('GET', support('/payout-account/name-check'), { token: agent })
    expect(res.status).toBe(200)
    expect(res.body.nameCheck).toMatchObject({
      stripeAccountId,
      stripeLegalName: 'KILN COLLECTIVE PRIVATE LIMITED',
      entityLegalName: 'Kiln Collective Private Limited',
      uen: UEN,
      status: 'onboarding',
      chargesEnabled: true,
      nameVerifiedAt: null,
      nameVerifiedBy: null,
      lastDecision: null,
    })
    expect(res.body.nameCheck.dashboardUrl).toContain(stripeAccountId)
    // the owner cannot read it, and cannot decide it
    const asOwner = await t.api('GET', support('/payout-account/name-check'), { token: founder })
    expect(asOwner.status).toBe(403)
  })

  it('keeps the account onboarding on a mismatch, and tells the owner why', async () => {
    const decide = (body: unknown) =>
      t.api('POST', support('/payout-account/name-check'), { token: agent, body })
    // a mismatch needs a note
    expect((await decide({ match: false, source: 'api' })).status).toBe(400)
    const note = 'The Stripe account is in the name of a different company.'
    const res = await decide({ match: false, source: 'api', note })
    expect(res.status).toBe(200)
    expect(res.body.nameCheck).toMatchObject({ status: 'onboarding', nameVerifiedAt: null })
    // the next person to open the check sees what was decided, by whom, and the note that was sent
    const reread = await t.api('GET', support('/payout-account/name-check'), { token: agent })
    expect(reread.body.nameCheck.lastDecision).toMatchObject({
      match: false,
      source: 'api',
      stripeLegalName: 'KILN COLLECTIVE PRIVATE LIMITED',
      note,
      decidedBy: 'agent@example.com',
    })
    const email = mailTo('founder@example.com').at(-1)
    expect(email?.subject).toContain('does not match')
    expect(email?.text).toContain(note)
    const audit = await t.db.query.auditLog.findMany({
      where: { profileId: company, action: 'payout_account.name_check' },
    })
    expect(audit.at(-1)?.metadata).toMatchObject({
      match: false,
      source: 'api',
      stripeLegalName: 'KILN COLLECTIVE PRIVATE LIMITED',
      entityLegalName: 'Kiln Collective Private Limited',
      note,
    })
    expect((await checkout(courseId, 'buyer-one@example.com')).body.error.code).toBe(
      'teacher_not_payable',
    )
  })

  it('activates the account when Support records a match, and checkout then pays the company', async () => {
    const res = await t.api('POST', support('/payout-account/name-check'), {
      token: agent,
      body: { match: true, source: 'api' },
    })
    expect(res.status).toBe(200)
    expect(res.body.nameCheck).toMatchObject({
      status: 'active',
      nameVerifiedBy: 'agent@example.com',
      lastDecision: { match: true, source: 'api', note: null },
    })
    expect(res.body.nameCheck.nameVerifiedAt).toEqual(expect.any(String))
    expect(mailTo('founder@example.com').at(-1)?.subject).toBe('Kiln Collective can now be paid')
    const view = await t.api('GET', teach('/profile'), { token: founder })
    expect(view.body.profile.payout).toMatchObject({
      status: 'active',
      businessType: 'company',
      nameVerified: true,
    })
    const detail = await t.api('GET', support(''), { token: agent })
    expect(detail.body.payoutAccounts).toMatchObject([
      { businessType: 'company', status: 'active', nameVerifiedBy: 'agent@example.com' },
    ])

    const started = await checkout(courseId, 'buyer-one@example.com')
    expect(started.status).toBe(200)
    expect(started.body.kind).toBe('redirect')
    const session = t.payments.sessions.get(started.body.sessionId)
    expect(session?.destinationAccountId).toBe(stripeAccountId)
    expect(session?.metadata).toMatchObject({ elevateProfileId: company })
  })

  it('stops selling again if Stripe withdraws charges or Support withdraws the match', async () => {
    await t.stripeWebhook(t.payments.disableAccount(stripeAccountId))
    expect(await payoutAccount()).toMatchObject({ status: 'onboarding', chargesEnabled: false })
    expect((await checkout(courseId, 'buyer-two@example.com')).body.error.code).toBe(
      'teacher_not_payable',
    )
    // charges come back: the name was already checked, so nothing else is needed
    await t.stripeWebhook(t.payments.enableAccount(stripeAccountId))
    expect(await payoutAccount()).toMatchObject({ status: 'active' })

    // the company changes its details in Stripe, and Support records that they no longer match
    const res = await t.api('POST', support('/payout-account/name-check'), {
      token: agent,
      body: {
        match: false,
        source: 'dashboard',
        stripeLegalName: 'Another Studio Pte. Ltd.',
        note: 'The account now shows a different company name.',
      },
    })
    expect(res.body.nameCheck).toMatchObject({ status: 'onboarding', nameVerifiedAt: null })
    expect((await checkout(courseId, 'buyer-two@example.com')).body.error.code).toBe(
      'teacher_not_payable',
    )
  })
})

describe('the name check', () => {
  it('does not depend on the order: a match recorded first activates the account when charges arrive', async () => {
    const early = await t.createProfile('early@example.com', {
      displayName: 'Early Bird',
      type: 'corporate',
    })
    const owner = await signIn('early@example.com')
    const id = early.profile.id
    // before Stripe onboarding has started there is no account to check
    const none = await t.api('GET', support('/payout-account/name-check', id), { token: agent })
    expect(none.body.error.code).toBe('no_payout_account')

    await t.api('POST', teach('/stripe/onboarding-link', id), { token: owner })
    const account = await payoutAccount(id)
    const acct = account?.stripeAccountId as string
    // Stripe has no legal name yet, so the check cannot be recorded as read from the API
    const fromApi = await t.api('POST', support('/payout-account/name-check', id), {
      token: agent,
      body: { match: true, source: 'api' },
    })
    expect(fromApi.status).toBe(409)
    expect(fromApi.body.error.code).toBe('no_stripe_name')
    // read in the Stripe dashboard instead, which means typing in the name that was read
    const unnamed = await t.api('POST', support('/payout-account/name-check', id), {
      token: agent,
      body: { match: true, source: 'dashboard' },
    })
    expect(unnamed.status).toBe(400)
    expect(unnamed.body.error.details).toMatchObject([{ path: 'stripeLegalName' }])
    // recorded, but charges are not enabled yet
    const fromDashboard = await t.api('POST', support('/payout-account/name-check', id), {
      token: agent,
      body: { match: true, source: 'dashboard', stripeLegalName: 'EARLY BIRD PTE. LTD.' },
    })
    expect(fromDashboard.body.nameCheck).toMatchObject({ status: 'onboarding' })
    expect(fromDashboard.body.nameCheck.nameVerifiedAt).toEqual(expect.any(String))
    const audit = await t.db.query.auditLog.findMany({
      where: { profileId: id, action: 'payout_account.name_check' },
    })
    expect(audit.at(-1)?.metadata).toMatchObject({
      match: true,
      source: 'dashboard',
      stripeLegalName: 'EARLY BIRD PTE. LTD.',
    })

    // Stripe enables charges. The webhook has not arrived, and the status poll activates it.
    t.payments.enableAccount(acct)
    const status = await t.api('GET', teach('/stripe/status', id), { token: owner })
    expect(status.body.stripe).toMatchObject({ status: 'active', nameVerified: true })
    expect((await payoutAccount(id))?.activatedAt).toBeInstanceOf(Date)
  })

  it('is only for a company with a Stripe account, and only for Support', async () => {
    const personal = await t.createProfile('solo@example.com', { payable: true })
    const res = await t.api('GET', support('/payout-account/name-check', personal.profile.id), {
      token: agent,
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('not_corporate')
    for (const token of [founder, await signIn('solo@example.com')]) {
      const refused = await t.api('POST', support('/payout-account/name-check'), {
        token,
        body: { match: true, source: 'dashboard' },
      })
      expect(refused.status).toBe(403)
    }
    expect((await t.api('GET', support('/payout-account/name-check'))).status).toBe(401)
  })

  it('leaves a person with a personal and a company profile holding two separate accounts', async () => {
    // the founder's personal profile, approved, opens its own account: an individual one
    const mine = await t.db.query.profiles.findMany({
      where: { ownerUserId: (await t.ensureUser('founder@example.com')).id },
    })
    const personal = mine.find((p) => p.type === 'personal')
    await t.api('POST', `/api/support/profiles/${personal?.id}/approve`, { token: agent, body: {} })
    const ownerNow = await signIn('founder@example.com')
    const link = await t.api('POST', teach('/stripe/onboarding-link', personal?.id), {
      token: ownerNow,
    })
    expect(link.status).toBe(200)
    const individual = await payoutAccount(personal?.id)
    const corporate = await payoutAccount()
    expect(individual?.businessType).toBe('individual')
    expect(corporate?.businessType).toBe('company')
    expect(individual?.stripeAccountId).not.toBe(corporate?.stripeAccountId)
    // an individual account needs no name check
    await t.stripeWebhook(t.payments.enableAccount(individual?.stripeAccountId as string))
    expect(await payoutAccount(personal?.id)).toMatchObject({ status: 'active' })
  })
})
