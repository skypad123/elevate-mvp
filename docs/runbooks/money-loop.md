# Money loop: manual acceptance script

The automated version of this script is `apps/api/test/money-loop.test.ts` (fake providers). This
is the same loop on real Stripe test-mode money, which is what the spec's acceptance criteria ask
for. Budget about 30 minutes the first time.

## Before you start

1. `docker compose up -d` (Postgres + Mailpit), `npm run db:migrate`, `npm run db:seed`.
2. Stripe sandbox keys in `.env` (`docs/runbooks/stripe.md`), and in a second terminal:
   `stripe listen --forward-to localhost:4400/api/webhooks/stripe --forward-connect-to localhost:4400/api/webhooks/stripe`.
   Without `stripe listen`, the checkout success page still completes the purchase through
   `GET /api/checkout/sessions/:id/sync`, but Connect `account.updated` events will not arrive;
   the Teach dashboard re-checks the account when you return from onboarding, so that path still
   works.
3. `npm run dev`. Mailpit at http://localhost:8025 shows every email (sign-in codes, receipts,
   certificates).

| Portal  | URL                   | Sign in as                                                              |
| ------- | --------------------- | ----------------------------------------------------------------------- |
| Teach   | http://localhost:5173 | any new email (apply)                                                   |
| Support | http://localhost:5174 | `SEED_SUPER_ADMIN_EMAIL` (super admin) or `support@example.com` (agent) |
| Learner | http://localhost:8081 | any new email                                                           |

## The loop

1. **Teacher applies.** Teach → sign in with a fresh email → fill the application (name, headline,
   bio, credentials, a sample link or upload) → "Application received".
2. **Support approves the profile.** Support → Profiles → Applications → open → Approve. No role is
   granted: the profile itself is approved, and the teacher sees it on their next request
   ("Check status", no re-login needed).
3. **Teacher connects Stripe.** Teach dashboard → Connect Stripe → complete the hosted Express
   onboarding with Stripe's test data shortcuts → back on `/p/<profile id>/stripe/return` the card
   should read "Payments enabled" (via `account.updated` or the return-page re-check).
4. **Teacher builds and submits a course.** Courses → New → Details (title, summary, description,
   category, thumbnail, price ≥ S$1) → Curriculum (a lesson with a text or video artefact, a second
   lesson with a quiz; set the pass mark) → Map (make lesson 2 require lesson 1) → Review → Submit.
   The checklist tells you what is missing; it needs the profile's payout account to be active.
5. **Support approves the course.** Support → Review queue → open → walk the preview → Approve.
   This is the only path to `live`.
6. **Learner pays.** Learner web → Explore → the course → Enrol → sign in with a third email →
   checkout (try `WELCOME10`) → Stripe Checkout with `4242 4242 4242 4242` → success page →
   "Start learning". Mailpit has the confirmation; the Stripe dashboard (test mode) shows the
   payment, the application fee and the transfer to the connected account.
7. **Learner completes.** Trail → lesson 1 (video plays through the signed URL, text marks as read)
   → lesson 2 unlocks → quiz → pass → "Course complete" → View certificate → Download PDF.
8. **Verify logged out.** Copy the verify link (`/c/{token}`), open it in a private window or on a
   phone: the certificate verifies with no sign-in (acceptance criterion 4).
9. **Teacher sees the payout.** Teach → Earnings: gross, Stripe fee (actual from the balance
   transaction), commission, net. "Check now" reconciles the ledger net with Stripe's transfers;
   the difference must be S$0.00 (acceptance criterion 5). "Open Stripe dashboard" shows the same
   transfer in the Express dashboard.
10. **Support sees the money.** Support → Transactions: the payment with its fee split and Stripe
    ids; Payout ledger: the total transferred to the profile's payout account; Audit log:
    approvals, payment, completion and certificate. As super admin, Refund in full reverses the
    transfer and application fee and removes the learner's access; the learner and the profile's
    owner each get a refund email.
11. **Support helps the teacher directly.** As super admin: Support → Profiles → the profile →
    Open in Teach. Teach shows a staff banner. Fix a typo in a lesson; the price field and the
    Stripe buttons are not available. Support → Audit log shows the change under your name.

## Mobile (Expo Go)

Install Expo Go on a phone on the same network, run `npm -w apps/learner start` and scan the QR
code. Sign in with the 6-digit code from Mailpit, open Explore → the course → the trail → a lesson
(video through `expo-video`, text, quiz) → the certificate. Enrol on a paid course hands off to the
web (`Continue on web`); there is no checkout in the app.
