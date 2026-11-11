import { schema as s } from '@elevate/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})

const stripePost = (event: unknown, signature = 'fake-valid') =>
  t.app.request('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    body: JSON.stringify(event),
  })

describe('stripe webhooks', () => {
  it('updates teacher Stripe flags on account.updated, dedupes, and ignores unknown types', async () => {
    const user = await t.grantRole('connect-teacher@example.com', 'teacher')
    const { accountId } = await t.payments.createConnectedAccount({
      email: user.email,
      userId: user.id,
      displayName: 'T',
    })
    await t.db
      .insert(s.teacherProfiles)
      .values({ userId: user.id, displayName: 'T', status: 'approved', stripeAccountId: accountId })

    const event = t.payments.enableAccount(accountId)
    const first = await stripePost(event)
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ received: true, outcome: 'applied' })
    const profile = await t.db.query.teacherProfiles.findFirst({
      where: { userId: user.id },
    })
    expect(profile?.stripeChargesEnabled).toBe(true)
    expect(profile?.stripePayoutsEnabled).toBe(true)
    expect(profile?.stripeDetailsSubmitted).toBe(true)

    const replay = await stripePost(event)
    expect(await replay.json()).toMatchObject({ duplicate: true })

    const unknown = await stripePost({ id: 'evt_x', type: 'payout.paid', data: { object: {} } })
    expect(await unknown.json()).toMatchObject({ outcome: 'ignored' })

    const orphan = await stripePost({
      id: 'evt_y',
      type: 'account.updated',
      data: { object: { id: 'acct_nobody', charges_enabled: true } },
    })
    expect(await orphan.json()).toMatchObject({ outcome: 'unmatched' })
  })

  it('rejects bad signatures', async () => {
    const res = await stripePost(
      { id: 'evt_bad', type: 'account.updated', data: { object: {} } },
      'wrong',
    )
    expect(res.status).toBe(400)
    const ledger = await t.db.query.webhookEvents.findMany({
      where: { eventId: 'evt_bad' },
    })
    expect(ledger).toHaveLength(0)
  })
})
