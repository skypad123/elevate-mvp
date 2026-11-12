# Stripe (sandbox) setup

Elevate uses Stripe Connect **destination charges**: the learner pays the platform, the full amount
is transferred to the connected account of the teaching profile that sold the course, and the
platform takes back an `application_fee_amount` that covers Stripe's fee plus the profile's
commission (see `docs/adr/003-payments-destination-charges.md` and
`docs/adr/007-payout-accounts.md`).

## 1. Create a sandbox and keys

1. Create a Stripe account (or a sandbox in an existing one) and switch to **Test mode**.
2. Dashboard → Developers → API keys → copy the **Secret key** (`sk_test_…`) into `.env` as
   `STRIPE_SECRET_KEY`. The publishable key (`pk_test_…`) does not work: Stripe refuses server
   calls made with it (`more_permissions_required`).
3. Dashboard → Connect → **Get started** and complete the platform profile. Until then, opening
   onboarding fails with "You can only create new accounts if you've signed up for Connect".
   Because teachers' accounts are created with `controller.losses.payments = application`, Stripe
   asks you once to acknowledge that the platform is responsible for negative balances.
4. Connect → Settings → Branding: set the Elevate name, icon and colours used on the hosted
   onboarding and Checkout pages.

## 2. Webhooks in development

Install the CLI and forward both the account scope and the Connect scope to the API:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --events account.updated,charge.refunded,checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to localhost:4400/api/webhooks/stripe --forward-connect-to localhost:4400/api/webhooks/stripe
```

Recent versions of the CLI refuse to start without `--events`. Paste the `whsec_…` the CLI prints
on its "Ready!" line into `.env` as `STRIPE_WEBHOOK_SECRET` (the CLI uses one secret for both
scopes). Restart the API.

Without the CLI the app still works: the checkout success page calls
`GET /api/checkout/sessions/:id/sync`, which re-reads the session from Stripe and runs the same
fulfilment code. A profile's onboarding status is re-read when its owner returns from Stripe.

## 3. Webhooks in production

Create two endpoints in Dashboard → Developers → Webhooks, both pointing at
`https://<api>/api/webhooks/stripe`:

- **Your account**: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `charge.refunded` → `STRIPE_WEBHOOK_SECRET`
- **Connected accounts**: `account.updated` → `STRIPE_CONNECT_WEBHOOK_SECRET`

## 4. Test data

- Card that succeeds: `4242 4242 4242 4242`, any future expiry, any CVC.
- Onboarding a test connected account: the hosted flow offers "Use test phone number", "Use test
  code", "Simulate" on the identity check, and "Use test account" for the bank. `000000000` works
  as an ID or business number, `01/01/1901` as a date of birth, and `address_full_match` as an
  address line (with a real postal code). Stripe's test document image is
  `https://d37ugbyn3rpeym.cloudfront.net/docs/identity/success.png`.
- "Retrieve Myinfo with Singpass" goes to Singpass's staging sign-in in test mode. Sign in as a
  Myinfo test persona (a UIN/FIN from the Myinfo test profile catalogue, with the staging password
  from the Singpass developer portal) and Stripe fills the person's name, date of birth, address
  and NRIC.
- Fees: Singapore domestic cards are 3.4% + S$0.50 (`STRIPE_FEE_BPS=340`,
  `STRIPE_FEE_FIXED_CENTS=50`). The earnings view shows the estimate and the actual fee from the
  balance transaction side by side.

## 5. Refunds and reconciliation

- Refund from Support (super admin only): `POST /api/support/transactions/:id/refund` calls
  `refunds.create({ payment_intent, reverse_transfer: true, refund_application_fee: true })`, so
  the teacher's transfer and the platform fee both come back before the learner is refunded. Stripe
  keeps its processing fee (the platform bears it, per `losses.payments: 'application'`). The
  payment becomes `refunded`, the enrolment `refunded` (access removed), and the learner and the
  owner of the profile that was paid each get an email.
- Refunds made in the Stripe dashboard arrive as `charge.refunded`; the webhook applies the same
  ledger change once per Stripe refund id, so a dashboard refund and a Support refund never double
  count. A dashboard refund sends the same two emails; a Support refund's own webhook sends none.
- Reconciliation (`GET /api/teach/profiles/:profileId/earnings/reconcile`) sums `transfers.list({ destination })`
  for the profile's payout account and compares it with Σ `teacher_net_cents` of the payments made
  to that account, net of refunds. A non-zero difference means a transfer happened outside this
  platform, a webhook was missed, or a paid session could not be attributed (see section 6): replay
  it from the Stripe dashboard (Developers → Webhooks → event → Resend) or hit
  `/api/checkout/sessions/:id/sync`.
- Partial refunds are not exposed in the UI; if one is made in the dashboard the ledger pro-rates
  the teacher net and marks the payment `partially_refunded`.

## 6. Payout accounts

- Each connected account is a `payout_accounts` row, one per teaching profile. It is created the
  first time the profile's owner opens Stripe onboarding, and reused for every later link. The
  Stripe account's metadata carries `elevateProfileId` and `elevatePayoutAccountId`.
- **Activation.** An individual account becomes `active` the first time Stripe enables charges,
  from the `account.updated` webhook or from the status check when the owner returns from
  onboarding. A course can be bought only while the account is `active` and Stripe still allows
  charges; otherwise checkout answers `teacher_not_payable`.
- **Who a sale pays.** The Checkout session's metadata carries `elevatePayoutAccountId` and
  `elevateProfileId`, and fulfilment writes the payment from them. If a paid session has neither,
  or names an account that does not exist, no payment is written: the webhook answers 500 and the
  event is stored in `webhook_events` with an `unattributed_checkout` error. The learner has paid
  and has no enrolment until someone acts on it.
- **Unknown accounts.** An `account.updated` event for a Stripe account with no row is stored in
  `webhook_events` with an `unknown_account` error. Accounts created before the database reset
  cause these; they can be ignored, or the accounts closed in the Stripe test dashboard.
- **Stripe links.** Only the profile's owner can open onboarding or the Stripe dashboard, and only
  with a sign-in from the last 24 hours; an older session is sent to sign in again. Each request
  is written to the audit log and emailed to the owner.

## 7. Company accounts and the legal-name check

- A corporate profile's payout account is created with `business_type: company`. It becomes
  `active` only when Stripe allows charges **and** Support has recorded that the legal name on the
  Stripe account matches the company Elevate approved. Either can come first.
- **The check** is on the profile's page in Support ("Legal-name check"): the name Stripe holds
  beside the company's legal name and UEN. Record "Names match", or "Names do not match" with a
  note; the note is emailed to the owner. When Stripe's API returns no legal name, open the
  account in Stripe ("Open in Stripe"), type the name the dashboard shows, and record the decision.
  The page shows the last decision and its note. If the company later changes its details in
  Stripe, record "Names no longer match": the account goes back to `onboarding` and selling stops.
- **API:** `GET` and `POST /api/support/profiles/:id/payout-account/name-check`, body
  `{ match, source: 'api' | 'dashboard', stripeLegalName?, note? }`. Each decision is audited as
  `payout_account.name_check`.

**What Stripe does with a company** (tested in a sandbox on 2026-11-12; details in the
design's Open Questions):

- Stripe creates the account with the settings used for individuals, and its onboarding asks for
  the UEN and the legal name, which "must exactly match the name associated with your UEN".
  Stripe checks them against the registry itself.
- The legal name is readable from the API (`company.name`) as soon as it is typed, before
  onboarding is submitted, so the name check can be done early. The UEN is not returned.
- **The account representative must be a Director or CEO on ACRA.** Otherwise the company names
  an authoriser who is one, and uploads a letter of authorisation they signed (Stripe's template
  is offered in the form). Only the person in Stripe's form can upload these: the platform cannot
  attach documents to the account. Tell a company owner who is not a director to have one ready.
- One person can hold an individual and a company account under the same email.
- The dashboard link opens the Express dashboard for that one account without a Stripe sign-in.

**Not testable in test mode:** a company account finishing onboarding. Stripe's test registry
lists no director for a made-up company, so the authority check fails with every test value
(`match_name_relationships` as the legal name does make Stripe verify the company itself). Check
the first real company's onboarding, its dashboard link and Support's "Open in Stripe" link (built
as `https://dashboard.stripe.com/[test/]connect/accounts/<id>`; in a Stripe sandbox, Stripe's own
links also carry the platform account) by hand.
