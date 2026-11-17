import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import { StripePaymentsProvider } from '../src/providers/payments/stripe'

const input = {
  enrollmentId: 'enr_1',
  payoutAccountId: 'acc_1',
  profileId: 'prof_1',
  courseTitle: 'A course',
  courseImageUrl: null,
  amountCents: 8000,
  currency: 'sgd',
  applicationFeeCents: 1200,
  destinationAccountId: 'acct_1',
  customerEmail: 'learner@example.com',
  successUrl: 'http://learner.test/checkout/success',
  cancelUrl: 'http://learner.test/course/a',
  replacesSessionId: 'cs_old',
  metadata: {},
}

describe('Stripe checkout sessions', () => {
  it('opens the session with a fresh key when Stripe refuses a repeated one', async () => {
    const provider = new StripePaymentsProvider({ secretKey: 'sk_test_fake', country: 'SG' })
    const keys: string[] = []
    const create = async (_params: unknown, options: { idempotencyKey: string }) => {
      keys.push(options.idempotencyKey)
      if (keys.length === 1)
        throw new Stripe.errors.StripeIdempotencyError({
          message: 'Keys for idempotent requests can only be used with the same parameters',
        })
      return { id: 'cs_new', url: 'https://checkout.stripe.test/cs_new' }
    }
    ;(provider.stripe.checkout.sessions as unknown as { create: typeof create }).create = create
    expect(await provider.createCheckoutSession(input)).toEqual({
      id: 'cs_new',
      url: 'https://checkout.stripe.test/cs_new',
    })
    expect(keys[0]).toBe('checkout:enr_1:8000:acc_1:none:cs_old')
    expect(keys[1]).toMatch(/^checkout:enr_1:8000:acc_1:none:cs_old:\d+$/)
  })

  it('does not retry other errors', async () => {
    const provider = new StripePaymentsProvider({ secretKey: 'sk_test_fake', country: 'SG' })
    let calls = 0
    const create = async () => {
      calls++
      throw new Stripe.errors.StripeAPIError({ message: 'down' })
    }
    ;(provider.stripe.checkout.sessions as unknown as { create: typeof create }).create = create
    await expect(provider.createCheckoutSession(input)).rejects.toThrow('down')
    expect(calls).toBe(1)
  })
})
