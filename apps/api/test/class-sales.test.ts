import { CLASS_SALES_TERMS_VERSION, SWITCHING_STALE_MS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ClassSalesService } from '../src/services/class-sales.service'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Opting in to class sales and leaving them (docs/designs/scheduled-classes-selling.md, "Opting
 * in", Phase 3 entry 3.12): the Teach routes, the Stripe account's payout mode on the fake, the
 * opening amounts, and the job's two steps, `finishStale` and `finishLeaving`.
 */
let t: TestApp
let n = 0
const DAY = 24 * 60 * 60_000
const MINUTE = 60_000

beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})

/** One session per person for the file: sign-in codes are limited per address. */
const sessions = new Map<string, string>()
async function teach(email: string) {
  const known = sessions.get(email)
  if (known) return known
  const token = (await t.signIn(email, 'teach')).token as string
  sessions.set(email, token)
  return token
}

/** A payable profile with a live course and a published class two weeks away. */
async function seller(options: { type?: 'personal' | 'corporate' } = {}) {
  const k = ++n
  const owner = `sales-owner-${k}@example.com`
  const { profile, payoutAccount } = await t.createProfile(owner, {
    payable: true,
    type: options.type,
    displayName: `Seller ${k}`,
  })
  if (!payoutAccount?.stripeAccountId) throw new Error('no payout account')
  const course = await t.createCourse(profile.id, { status: 'live', priceCents: 50000 })
  const { classId } = await t.createClass(profile.id, course.courseId, {
    blocks: [{ startMs: 14 * DAY, endMs: 14 * DAY + 3 * 60 * MINUTE }],
  })
  const base = `/api/teach/profiles/${profile.id}/class-sales`
  return {
    owner,
    profileId: profile.id,
    payoutAccountId: payoutAccount.id,
    stripeAccountId: payoutAccount.stripeAccountId,
    courseId: course.courseId,
    classId,
    base,
  }
}

const account = (id: string) => t.db.query.payoutAccounts.findFirst({ where: { id } })

/** Why the class is not on sale, as a learner's checkout page is told; null when it is. */
async function notOnSale(classId: string) {
  const res = await t.api('GET', `/api/checkout/classes/${classId}`, {
    token: await t.learnerToken('sales-browser@example.com'),
  })
  if (res.status === 200) return null
  expect(res.status).toBe(409)
  expect(res.body.error.code).toBe('class_not_on_sale')
  return res.body.error.details.reason as string
}

describe('opting in', () => {
  it('records the acceptance, switches the account to manual payouts and writes both opening amounts', async () => {
    const f = await seller()
    // money earned before opting in: some available, some pending
    const money = t.payments.moneyOf(f.stripeAccountId)
    money.availableCents = 12_000
    money.pendingCents = 3_450
    const token = await teach(f.owner)
    expect((await t.api('GET', f.base, { token })).body.classSales).toMatchObject({
      payoutMode: 'automatic',
      payable: true,
      acceptedAt: null,
      currentTermsVersion: CLASS_SALES_TERMS_VERSION,
    })
    expect(await notOnSale(f.classId)).toBe('profile_not_opted_in')

    const res = await t.api('POST', `${f.base}/accept`, {
      token,
      body: { termsVersion: CLASS_SALES_TERMS_VERSION },
    })
    expect(res.status).toBe(200)
    expect(res.body.classSales).toMatchObject({
      payoutMode: 'manual',
      acceptedAt: t.now().toISOString(),
      termsVersion: CLASS_SALES_TERMS_VERSION,
      leaveOn: null,
    })
    expect(money.payoutMode).toBe('manual')
    const owner = await t.ensureUser(f.owner)
    const profile = await t.db.query.profiles.findFirst({ where: { id: f.profileId } })
    expect(profile).toMatchObject({
      classSalesAcceptedBy: owner.id,
      classSalesTermsVersion: CLASS_SALES_TERMS_VERSION,
    })
    expect((await account(f.payoutAccountId))?.manualSince?.toISOString()).toBe(
      t.now().toISOString(),
    )
    const openings = await t.db.query.payoutAdjustments.findMany({
      where: { payoutAccountId: f.payoutAccountId },
      orderBy: { kind: 'asc' },
    })
    expect(openings.map((a) => [a.kind, a.amountCents, a.payoutId])).toEqual([
      ['opening_available', 12_000, null],
      ['opening_pending', 3_450, null],
    ])
    const audit = await t.db.query.auditLog.findMany({
      where: { action: 'class_sales.accepted', profileId: f.profileId },
    })
    expect(audit).toHaveLength(1)
    expect(audit[0]?.actorId).toBe(owner.id)
    // the class is on sale now
    expect(await notOnSale(f.classId)).toBeNull()
  })

  it('is the owner’s alone: a manager and a writer are refused', async () => {
    const f = await seller({ type: 'corporate' })
    await t.addMember(f.profileId, `sales-manager-${n}@example.com`, 'manager')
    await t.addMember(f.profileId, `sales-writer-${n}@example.com`, 'writer')
    for (const email of [`sales-manager-${n}@example.com`, `sales-writer-${n}@example.com`]) {
      const token = await teach(email)
      for (const path of [`${f.base}/accept`, `${f.base}/leave`]) {
        const res = await t.api('POST', path, {
          token,
          body: { termsVersion: CLASS_SALES_TERMS_VERSION },
        })
        expect(res.status, `${email} ${path}`).toBe(403)
      }
      // both can read where it stands
      expect((await t.api('GET', f.base, { token })).status).toBe(200)
    }
    expect((await account(f.payoutAccountId))?.payoutMode).toBe('automatic')
  })

  it('refuses a second opt-in, old terms, an account that cannot be paid, and an old sign-in', async () => {
    const f = await seller()
    const token = await teach(f.owner)
    const accept = (termsVersion = CLASS_SALES_TERMS_VERSION) =>
      t.api('POST', `${f.base}/accept`, { token, body: { termsVersion } })

    const old = await accept('2025-01')
    expect(old.status).toBe(422)
    expect(old.body.error).toMatchObject({
      code: 'terms_version',
      details: { current: CLASS_SALES_TERMS_VERSION },
    })

    await t.db
      .update(s.payoutAccounts)
      .set({ chargesEnabled: false })
      .where(eq(s.payoutAccounts.id, f.payoutAccountId))
    const unpaid = await accept()
    expect(unpaid.status).toBe(409)
    expect(unpaid.body.error.code).toBe('not_payable')
    await t.db
      .update(s.payoutAccounts)
      .set({ chargesEnabled: true })
      .where(eq(s.payoutAccounts.id, f.payoutAccountId))

    expect((await accept()).status).toBe(200)
    const again = await accept()
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('already_opted_in')
    // one set of opening amounts
    expect(
      await t.db.$count(
        s.payoutAdjustments,
        eq(s.payoutAdjustments.payoutAccountId, f.payoutAccountId),
      ),
    ).toBe(2)

    // a sign-in more than a day old must be renewed first
    const g = await seller()
    const stale = await teach(g.owner)
    t.advanceClock(25 * 60 * MINUTE)
    const reauth = await t.api('POST', `${g.base}/accept`, {
      token: stale,
      body: { termsVersion: CLASS_SALES_TERMS_VERSION },
    })
    expect(reauth.status).toBe(401)
    expect(reauth.body.error.code).toBe('reauth_required')
    sessions.delete(g.owner)
  })

  it('leaves an opt-in that Stripe interrupted at switching, not on sale, until the job finishes it', async () => {
    const f = await seller()
    const token = await teach(f.owner)
    t.payments.failNext('setManualPayouts', 'retryable')
    const res = await t.api('POST', `${f.base}/accept`, {
      token,
      body: { termsVersion: CLASS_SALES_TERMS_VERSION },
    })
    // the acceptance is recorded; the Stripe steps are left for the job
    expect(res.status).toBe(200)
    expect(res.body.classSales).toMatchObject({ payoutMode: 'switching' })
    expect(t.payments.moneyOf(f.stripeAccountId).payoutMode).toBe('automatic')
    expect(await notOnSale(f.classId)).toBe('profile_not_opted_in')
    // a second request does not start it again
    const again = await t.api('POST', `${f.base}/accept`, {
      token,
      body: { termsVersion: CLASS_SALES_TERMS_VERSION },
    })
    expect(again.body.error.code).toBe('already_opted_in')

    const sales = new ClassSalesService(t.deps)
    // not yet stale: the request may still be running
    expect(await sales.finishStale(new Date(t.now().getTime() + SWITCHING_STALE_MS))).toBe(0)
    t.advanceClock(SWITCHING_STALE_MS + MINUTE)
    expect(await sales.finishStale(t.now())).toBe(1)
    expect((await account(f.payoutAccountId))?.payoutMode).toBe('manual')
    expect(t.payments.moneyOf(f.stripeAccountId).payoutMode).toBe('manual')
    expect(
      await t.db.$count(
        s.payoutAdjustments,
        eq(s.payoutAdjustments.payoutAccountId, f.payoutAccountId),
      ),
    ).toBe(2)
    expect(await notOnSale(f.classId)).toBeNull()
    // finishing again does nothing
    expect(await sales.finishStale(t.now())).toBe(0)
  })
})

describe('leaving', () => {
  it('takes the classes off sale at notice, is the owner’s alone, and ends only when nothing is held', async () => {
    const f = await seller({ type: 'corporate' })
    const manager = `leave-manager-${n}@example.com`
    await t.addMember(f.profileId, manager, 'manager')
    await t.optIn(f.profileId)
    const sold = await t.buySeat(`leave-learner-${n}@example.com`, f.classId)
    expect(sold.payment?.classId).toBe(f.classId)

    // a manager cannot give notice; leaving before opting in is refused elsewhere
    expect((await t.api('POST', `${f.base}/leave`, { token: await teach(manager) })).status).toBe(
      403,
    )
    const token = await teach(f.owner)
    const notice = await t.api('POST', `${f.base}/leave`, { token })
    expect(notice.status).toBe(200)
    const leaveOn = new Date(t.now().getTime() + 30 * DAY)
    expect(notice.body.classSales).toMatchObject({
      payoutMode: 'manual',
      leaveRequestedAt: t.now().toISOString(),
      leaveOn: leaveOn.toISOString(),
    })
    expect(await notOnSale(f.classId)).toBe('profile_leaving')
    const twice = await t.api('POST', `${f.base}/leave`, { token })
    expect(twice.status).toBe(409)
    expect(twice.body.error.code).toBe('not_opted_in')
    expect(
      await t.db.query.auditLog.findFirst({
        where: { action: 'class_sales.leave_requested', profileId: f.profileId },
      }),
    ).toBeDefined()

    const sales = new ClassSalesService(t.deps)
    const after = new Date(leaveOn.getTime() + DAY)
    // the date has not come
    expect(await sales.finishLeaving(new Date(leaveOn.getTime() - MINUTE))).toBe(0)
    // a class payment is still held
    expect(await sales.finishLeaving(after)).toBe(0)
    const paymentId = sold.payment?.id as string
    await t.db
      .update(s.payments)
      .set({ releasedAt: after, releaseReason: 'due' })
      .where(eq(s.payments.id, paymentId))
    // a seat refund is unfinished
    const [row] = await t.db
      .insert(s.seatRefunds)
      .values({
        enrollmentId: sold.enrollmentId,
        paymentId,
        classId: f.classId,
        kind: 'discretionary',
        requestedCents: 1000,
        reason: 'A fixture refund',
      })
      .returning()
    expect(await sales.finishLeaving(after)).toBe(0)
    await t.db
      .update(s.seatRefunds)
      .set({ status: 'done', completedAt: after })
      .where(eq(s.seatRefunds.id, row?.id as string))
    expect((await account(f.payoutAccountId))?.payoutMode).toBe('manual')

    t.mailer.sent.length = 0
    expect(await sales.finishLeaving(after)).toBe(1)
    expect(t.payments.moneyOf(f.stripeAccountId).payoutMode).toBe('automatic')
    expect(await account(f.payoutAccountId)).toMatchObject({
      payoutMode: 'automatic',
      leaveRequestedAt: null,
      leaveOn: null,
      manualSince: null,
    })
    expect(
      await t.db.query.auditLog.findFirst({
        where: { action: 'class_sales.left', profileId: f.profileId },
      }),
    ).toBeDefined()
    const mail = t.mailer.sent.find((m) => m.to === f.owner)
    expect(mail?.subject).toContain('no longer sells classes')
    expect(await sales.finishLeaving(after)).toBe(0)

    // the profile can opt in again
    const back = await t.api('POST', `${f.base}/accept`, {
      token,
      body: { termsVersion: CLASS_SALES_TERMS_VERSION },
    })
    expect(back.status).toBe(200)
    expect(back.body.classSales).toMatchObject({ payoutMode: 'manual', leaveOn: null })
  })

  it('refuses notice from a profile that has not opted in', async () => {
    const f = await seller()
    const res = await t.api('POST', `${f.base}/leave`, { token: await teach(f.owner) })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('not_opted_in')
  })
})
