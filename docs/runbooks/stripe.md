# Stripe (sandbox) setup

Elevate uses Stripe Connect **destination charges**: the learner pays the platform, the full amount
is transferred to the teacher's connected account, and the platform takes back an
`application_fee_amount` that covers Stripe's fee plus the per-teacher commission
(see `docs/adr/003-payments-destination-charges.md`).

## 1. Create a sandbox and keys

1. Create a Stripe account (or a sandbox in an existing one) and switch to **Test mode**.
2. Dashboard → Developers → API keys → copy the **Secret key** (`sk_test_…`) into `.env` as
   `STRIPE_SECRET_KEY`.
3. Dashboard → Connect → **Get started** and complete the platform profile. Because teachers'
   accounts are created with `controller.losses.payments = application`, Stripe asks you once to
   acknowledge that the platform is responsible for negative balances.
4. Connect → Settings → Branding: set the Elevate name, icon and colours used on the hosted
   onboarding and Checkout pages.

## 2. Webhooks in development

Install the CLI and forward both the account scope and the Connect scope to the API:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:4400/api/webhooks/stripe --forward-connect-to localhost:4400/api/webhooks/stripe
```

Paste the `whsec_…` the CLI prints into `.env` as `STRIPE_WEBHOOK_SECRET` (the CLI uses one secret
for both scopes). Restart the API.

Without the CLI the app still works: the checkout success page calls
`GET /api/checkout/sessions/:id/sync`, which re-reads the session from Stripe and runs the same
fulfilment code. Teacher onboarding status is re-read when they return from Stripe.

## 3. Webhooks in production

Create two endpoints in Dashboard → Developers → Webhooks, both pointing at
`https://<api>/api/webhooks/stripe`:

- **Your account**: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `charge.refunded` → `STRIPE_WEBHOOK_SECRET`
- **Connected accounts**: `account.updated` → `STRIPE_CONNECT_WEBHOOK_SECRET`

## 4. Test data

- Card that succeeds: `4242 4242 4242 4242`, any future expiry, any CVC.
- Onboarding a test connected account: use the "Use test data" shortcuts Stripe offers in the
  hosted flow; `000 000 000` style test identifiers are accepted.
- Fees: Singapore domestic cards are 3.4% + S$0.50 (`STRIPE_FEE_BPS=340`,
  `STRIPE_FEE_FIXED_CENTS=50`). The earnings view shows the estimate and the actual fee from the
  balance transaction side by side.

## 5. Refunds and reconciliation

- Refund from Support (super admin only): `POST /api/support/transactions/:id/refund` calls
  `refunds.create({ payment_intent, reverse_transfer: true, refund_application_fee: true })`, so
  the teacher's transfer and the platform fee both come back before the learner is refunded. Stripe
  keeps its processing fee (the platform bears it, per `losses.payments: 'application'`). The
  payment becomes `refunded`, the enrolment `refunded` (access removed), and the learner gets an
  email.
- Refunds made in the Stripe dashboard arrive as `charge.refunded`; the webhook applies the same
  ledger change once per Stripe refund id, so a dashboard refund and a Support refund never double
  count.
- Teacher reconciliation (`GET /api/teach/earnings/reconcile`) sums `transfers.list({ destination })`
  for the connected account and compares it with Σ `teacher_net_cents` net of refunds. A non-zero
  difference means a transfer happened outside this platform or a webhook was missed: replay it from
  the Stripe dashboard (Developers → Webhooks → event → Resend) or hit `/api/checkout/sessions/:id/sync`.
- Partial refunds are not exposed in the UI; if one is made in the dashboard the ledger pro-rates
  the teacher net and marks the payment `partially_refunded`.

