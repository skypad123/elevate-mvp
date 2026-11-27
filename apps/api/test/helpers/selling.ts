import { schema as s } from '@elevate/db'
import Stripe from 'stripe'
import type { PaymentsProvider } from '../../src/providers/payments'
import { ReleaseService } from '../../src/services/release.service'
import type { TestApp } from './test-app'

/**
 * Fixtures for the release job's tests (docs/designs/scheduled-classes-selling.md, Phase 5): the
 * S$500 example of the amounts table, an opted-in seller, classes, seats, self-paced sales,
 * attendance rows and a run.
 */

/** The amounts table: price A, Elevate's fee C + E, the profile's share N, Stripe's fee F. */
export const A = 50000
export const FEE = 8988
export const N = 41012
export const F = 2000
export const K = FEE - F

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

let n = 0

export type Seller = Awaited<ReturnType<typeof seller>>

/** A profile of its own, opted in, with a live S$500 course: its fake balance starts at zero. */
export async function seller(t: TestApp, options: { optIn?: boolean } = {}) {
  const email = `seller-${++n}@example.com`
  const { profile } = await t.createProfile(email, { payable: true, displayName: `Seller ${n}` })
  const course = await t.createCourse(profile.id, {
    status: 'live',
    priceCents: A,
    title: 'Wheel throwing',
  })
  if (options.optIn !== false) await t.optIn(profile.id)
  const account = await t.db.query.payoutAccounts.findFirst({ where: { profileId: profile.id } })
  if (!account?.stripeAccountId) throw new Error('no payout account')
  return {
    email,
    profileId: profile.id,
    courseId: course.courseId,
    slug: course.slug,
    payoutAccountId: account.id,
    accountId: account.stripeAccountId,
  }
}

/** A Teach session for the seller, signed in now so it counts as recent. */
export const teachToken = async (t: TestApp, sell: Seller) =>
  (await t.signIn(sell.email, 'teach')).token as string

/** A block `startDay` days after the test clock, `hours` long. */
export const block = (startDay: number, hours = 2) => ({
  startMs: startDay * DAY,
  endMs: startDay * DAY + hours * HOUR,
})

/** A published class, by default one block of two hours a day from now. */
export async function newClass(t: TestApp, sell: Seller, blocks = [block(1)]) {
  const made = await t.createClass(sell.profileId, sell.courseId, { blocks })
  const lastEndsAt = new Date(t.now().getTime() + Math.max(...blocks.map((b) => b.endMs)))
  return { ...made, lastEndsAt }
}

/** A paid seat, with Stripe's fee at S$20.00 unless told otherwise. */
export async function seat(
  t: TestApp,
  classId: string,
  options: Parameters<TestApp['buySeat']>[2] = {},
) {
  const email = `learner-${++n}@example.com`
  const bought = await t.buySeat(email, classId, { stripeFeeCents: F, ...options })
  if (!bought.payment?.stripePaymentIntentId) throw new Error('the seat was not paid')
  const user = await t.ensureUser(email)
  return {
    email,
    userId: user.id,
    token: bought.token,
    enrollmentId: bought.enrollmentId,
    paymentId: bought.payment.id,
    paymentIntentId: bought.payment.stripePaymentIntentId,
    sessionId: bought.sessionId,
  }
}

/** A self-paced sale of a course, with Stripe's fee at S$20.00. */
export async function buyCourse(t: TestApp, courseId: string) {
  const email = `buyer-${++n}@example.com`
  const token = await t.learnerToken(email)
  const started = await t.api('POST', `/api/checkout/courses/${courseId}`, { token, body: {} })
  if (started.body.kind !== 'redirect')
    throw new Error(`checkout failed: ${JSON.stringify(started.body)}`)
  const sessionId = started.body.sessionId as string
  t.payments.setStripeFee(sessionId, F)
  const hook = await t.stripeWebhook(t.payments.completeCheckout(sessionId))
  if (hook.status !== 200) throw new Error(`webhook failed: ${JSON.stringify(hook.body)}`)
  const payment = await t.db.query.payments.findFirst({
    where: { stripeCheckoutSessionId: sessionId },
  })
  if (!payment?.stripePaymentIntentId) throw new Error('the course was not paid')
  return { email, token, paymentId: payment.id, paymentIntentId: payment.stripePaymentIntentId }
}

/** An attendance row for a learner, written straight to the database. */
export async function attendance(
  t: TestApp,
  learner: { enrollmentId: string; userId: string },
  classId: string,
  blockId: string,
  type: 'check_in' | 'manual_mark' = 'check_in',
) {
  const found = await t.db.query.classes.findFirst({
    where: { id: classId },
    with: { profile: true },
  })
  const [row] = await t.db
    .insert(s.attendanceEvents)
    .values({
      classId,
      blockId,
      enrollmentId: learner.enrollmentId,
      learnerUserId: learner.userId,
      type,
      actorUserId: type === 'check_in' ? learner.userId : (found?.profile.ownerUserId ?? ''),
      actorRole: type === 'check_in' ? 'learner' : 'owner',
      requestId: 'fixture',
      createdAt: t.now(),
      ...(type === 'check_in'
        ? { method: 'typed_code', locationStatus: 'ok', accuracyM: 10, distanceM: 5 }
        : { reasonCode: 'phone_not_working', idDocumentType: 'nric' }),
    })
    .returning()
  if (!row) throw new Error('failed to write an attendance row')
  return row
}

/** One release run at the test clock, or at `at`, which the clock is first moved to. */
export async function run(t: TestApp, at?: Date) {
  if (at) t.setClock(at)
  return new ReleaseService(t.deps).run(t.now())
}

/**
 * The fake provider, except that each method named makes its call at Stripe and then fails as a
 * lost connection: the run that made the call dies before it can record the answer.
 */
export function lostAnswers(
  fake: TestApp['payments'],
  methods: readonly (keyof PaymentsProvider)[],
): PaymentsProvider & { calls: Record<string, number> } {
  const calls: Record<string, number> = {}
  return new Proxy(fake, {
    get(target, prop, receiver) {
      if (prop === 'calls') return calls
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        calls[String(prop)] = (calls[String(prop)] ?? 0) + 1
        const answer = value.apply(target, args)
        if (!(methods as readonly (string | symbol)[]).includes(prop)) return answer
        return Promise.resolve(answer).then(() => {
          throw new Stripe.errors.StripeConnectionError({
            message: `lost the answer to ${String(prop)}`,
          })
        })
      }
    },
  }) as unknown as PaymentsProvider & { calls: Record<string, number> }
}

/** The fake provider with each call counted. */
export const counted = (fake: TestApp['payments']) => lostAnswers(fake, [])
