# ADR 003 — Stripe Connect destination charges, controller-property accounts, platform promo codes

**Status:** accepted · 2026-11-08

## Decision

- Teachers get connected accounts created with **controller properties** replicating Express
  (`stripe_dashboard.type: express`, `fees.payer: application`, `losses.payments: application`);
  Stripe marks `type: 'express'` as legacy for new platforms.
- Learners pay through a hosted Checkout Session that is a **destination charge**:
  `payment_intent_data.transfer_data.destination` = teacher account,
  `payment_intent_data.application_fee_amount` = Stripe fee estimate + platform commission.
- Fee math (`packages/core/src/domain/money.ts`), integer cents:
  `amount = list − discount` → `stripeFeeEst = round(amount·bps/10000) + fixed` →
  `commission = round((amount − stripeFeeEst)·commissionBps/10000)` →
  `teacherNet = amount − stripeFeeEst − commission` → `applicationFee = amount − teacherNet`.
  Defaults: 340 bps + 50 cents (Singapore domestic cards), commission 1500 bps per teacher.
- Promo codes live in our database, not in Stripe, so the application fee is computed on the final
  amount and stays exact. Amounts below Stripe's S$0.50 minimum are rejected; S$0 takes a free path.
- Fulfilment happens on `checkout.session.completed` (and on a success-page `sync` call that runs the
  same idempotent handler). The actual Stripe fee comes from the expanded balance transaction.
- Refunds use `reverse_transfer: true, refund_application_fee: true`; the platform absorbs Stripe's fee.

## Consequences

- Earnings reconcile to the Stripe dashboard: Σ teacher net = Σ transfers, Σ application fees match.
- `account.updated` events arrive on the Connect scope; local dev needs
  `stripe listen --forward-to … --forward-connect-to …`.
- Test mode never sends Stripe receipts, so the API sends its own confirmation email.

## Update · 2026-11-12

Teachers became teaching profiles ([ADR 006](006-teacher-profiles.md)). The destination of a
charge is now the Stripe account of the profile's payout account, and the commission rate is the
profile's. The fee math is unchanged. How the payee is chosen, recorded and activated is in
[ADR 007](007-payout-accounts.md).
