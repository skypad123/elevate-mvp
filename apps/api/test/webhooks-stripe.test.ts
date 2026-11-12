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
  it('updates the payout account on account.updated, dedupes, and ignores unknown types', async () => {
    const { profile } = await t.createProfile('connect-teacher@example.com', { displayName: 'T' })
    const [account] = await t.db
      .insert(s.payoutAccounts)
      .values({ profileId: profile.id, businessType: 'individual' })
      .returning()
    const { accountId } = await t.payments.createConnectedAccount({
      businessType: 'individual',
      profileId: profile.id,
      payoutAccountId: account?.id as string,
      email: 'connect-teacher@example.com',
      displayName: 'T',
    })
    await t.db.update(s.payoutAccounts).set({ stripeAccountId: accountId })

    const event = t.payments.enableAccount(accountId)
    const first = await stripePost(event)
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ received: true, outcome: 'applied' })
    const updated = await t.db.query.payoutAccounts.findFirst({ where: { profileId: profile.id } })
    expect(updated).toMatchObject({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      // an individual account becomes active the first time charges are enabled
      status: 'active',
    })
    expect(updated?.activatedAt).toBeInstanceOf(Date)

    const replay = await stripePost(event)
    expect(await replay.json()).toMatchObject({ duplicate: true })

    const unknown = await stripePost({ id: 'evt_x', type: 'payout.paid', data: { object: {} } })
    expect(await unknown.json()).toMatchObject({ outcome: 'ignored' })
  })

  it('stores an error for an account.updated about an account it does not know', async () => {
    const orphan = {
      id: 'evt_y',
      type: 'account.updated',
      data: { object: { id: 'acct_nobody', charges_enabled: true } },
    }
    const res = await stripePost(orphan)
    expect(res.status).toBe(500)
    const [stored] = await t.db.query.webhookEvents.findMany({ where: { eventId: 'evt_y' } })
    expect(stored?.error).toContain('unknown_account')
    expect(stored?.error).toContain('acct_nobody')
    // Stripe retries a failed delivery; the retry is acknowledged as a duplicate
    const retry = await stripePost(orphan)
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ duplicate: true })
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
