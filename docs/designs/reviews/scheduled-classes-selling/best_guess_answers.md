# Best-Guess Answers: Scheduled Classes, Part 2 (Selling a Class)

- **Why:** the author wants to build before asking anyone outside the
  company. This file gives each open question a researched best guess to
  build on, and records the author's decision on it.
- **Date:** 2026-11-25
- **What a best guess is:** the answer the sources support best today. It is
  not confirmed. Each entry names who can confirm it. Nothing here is legal
  advice, and no lawyer has read it.
- **The gates:** the build goes ahead on these answers. The author removed
  the licensing question as a gate before selling to real learners (G9).
  The rollout still waits for Stripe's answer on the 90 days and for a
  lawyer to read both sets of terms; the author decided on 2026-11-25 to
  keep both.
- **How the research was done:** Stripe's documentation and support pages;
  MAS, PDPC, CCCS and ministry pages; and tests in the author's Stripe
  sandbox. The statute site refused automated reading, so statute wording was
  read from copies and from the Bill. Each such quote is marked "check
  against the statute".

Status of each entry: **accepted** (the author took the best guess),
**decided** (the author chose among options), or **open**.

## Stripe

### G1. How the 90 days of a manual payout are counted

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** count from each payment, the strictest reading. Keep the
  75-day and 85-day limits.
- **Basis:** Stripe does not say when the count starts or what happens at
  the limit. The only hint is an old page: "Stripe will hold funds in the
  account holder's balance until told to pay them out (or until a maximum of
  90 days have passed)"
  (`docs.stripe.com/connect/legacy-transfers`).
- **Confidence:** low on what Stripe does; high that the strict reading is
  safe.
- **Confirm with:** Stripe's support (question 1 and 2).
- **Changes:** none.

### G2. The two Express dashboard features, for some accounts or all

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** all accounts only. Both features are turned off for every
  teacher, opted in or not.
- **Basis:** the setting is one list in the platform's Connect settings, and
  no setting for one account is documented. A manual schedule does not stop
  self-payout: Stripe's help page for account holders says the "Pay out"
  button shows "if your platform has enabled Manual payouts and your payout
  schedule is set to manual"
  (`support.stripe.com/express/questions/how-do-i-manage-my-payouts`).
- **Confidence:** medium. The absence of a per-account setting is inferred
  from silence.
- **Confirm with:** Stripe's support (question 3).
- **Changes:** see G15, the notice to teachers.

### G3. The liveness check in a sandbox

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** there is no test value for it. Two routes may work without
  a real identity: Stripe's hosted onboarding with a Myinfo test login, or a
  Stripe Identity session tied to the account's person.
- **Basis:** "Stripe-hosted onboarding can complete all variations of
  `proof_of_liveness` requirements", and a Stripe Identity session with
  `related_person` "automatically updates the account"
  (`docs.stripe.com/connect/api-onboarding`). In a sandbox "Identity doesn't
  perform any verification checks" (`docs.stripe.com/test-mode`).
- **Confidence:** medium to low. Neither route has been tried on the test
  account.
- **Confirm with:** a try in the sandbox. Not yet done.
- **Changes:** none. It decides how soon the payout test can run.

### G4. The Link button on a class payment page

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** turn Link off for class checkout. Leave Apple Pay on.
- **Basis:** tested in the sandbox on 2026-11-25. A payment page created
  with `wallet_options.link.display` set to `never` showed Card, PayNow and
  Apple Pay, and no Link button. Stripe added the setting on 2025-04-30.
  Apple Pay is a card payment and can only be turned off for the whole
  account.
- **Confidence:** high.
- **Changes:** class checkout sends the setting. The open question on Link,
  and the Link test before Phase 3, are removed.

### G5. A refund after Elevate wins a bank dispute

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** it works, so a refund that waited for the dispute resumes.
- **Basis:** tested in the sandbox on 2026-11-25. While the dispute was open
  the refund was refused with `charge_disputed`. After the dispute was won,
  the refund with the transfer reversed succeeded, and so did the fee refund.
  The teacher ended S$20.00 down on the seat, which is Stripe's fee, as the
  design intends.
- **Confidence:** high in the sandbox.
- **Changes:** the open question is closed.

### G6. A refund that fails after Stripe accepted it

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** the refunded money comes back to Elevate's balance, and the
  transfer taken back from the teacher stays taken back. Support then pays
  the learner another way, from that money.
- **Basis:** "If your platform uses Connect with destination charges, funds
  from a failed refund deposit to your platform account's Stripe balance",
  and "you need to arrange an alternative way to provide your customer with
  a refund" (`docs.stripe.com/refunds`). Stripe says nothing about undoing
  the reversal.
- **Confidence:** high that the money returns to Elevate; medium to low that
  the reversal stands.
- **Confirm with:** the first failed refund seen, or Stripe's support.
- **Changes:** the open question says this.

### G7. Stripe's fees, and what the terms can state

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** the terms state Stripe's published rates: 3.4% plus S$0.50
  for a card issued in Singapore, 0.5% more for a card issued elsewhere, 2%
  more when the currency is converted, and 1.3% for PayNow, with GST where
  Stripe adds it. Stripe keeps its fee when a payment is refunded.
- **Basis:** `stripe.com/en-sg/pricing`, and "Stripe's processing fees from
  the original transaction aren't returned" (`docs.stripe.com/refunds`). In
  the sandbox, GST was added to the PayNow fee (S$0.59 on S$6.50) and none
  showed on the card fee.
- **Confidence:** high on the rates; medium on where GST applies.
- **Confirm with:** the first live payments.
- **Changes:** both sets of terms state rates in place of two tested
  amounts.

### G8. How long a refund takes

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** the terms say Elevate sends a refund within one working
  day, that a card refund then shows in 5 to 10 business days, and that a
  PayNow refund arrives within minutes.
- **Basis:** "Your customer sees the refund as a credit approximately 5-10
  business days later, depending upon the bank" (`docs.stripe.com/refunds`).
  PayNow refunds "take up to 5 minutes to complete"
  (`docs.stripe.com/payments/paynow`). The release job runs every 15 minutes.
  No law was found that requires a time; a voluntary Singapore standard for
  online sales says a refund policy should give one.
- **Confidence:** high on Stripe's times; medium on the law.
- **Changes:** refund term 12 gives the times.

## Licensing

### G9. Whether controlling a teacher's payout needs a licence

- **Status:** decided by the author on 2026-11-25: build now and sell to
  real learners without waiting for the lawyer's answer. The best guess
  stands as the basis; the exposure below is accepted.
- **Best guess:** keep the design as it is, with the money in the teacher's
  own Stripe account. Of the two shapes it carries the lower risk. The
  question is not settled either way, so the gate before real learners
  stays.
- **Basis:**
  - A "merchant acquisition service" is "accepting and processing a payment
    transaction for a merchant under a contract between the provider of the
    service and the merchant ... regardless whether the provider of the
    service comes into possession of any money" (Payment Services Act 2019,
    First Schedule; check against the statute). This could reach either
    shape. It turns on whether Elevate is the seller that uses Stripe, or is
    processing payments for the teacher.
  - A "domestic money transfer service" includes "accepting any money from
    any person for transfer to the payment account of a different person"
    (same Schedule; check against the statute). Holding the money in
    Elevate's own balance and transferring it later fits that wording. The
    present design does not: Stripe, a licensed institution, holds the money
    in the teacher's account.
  - MAS wrote, in its response to the Bill's consultation: "online
    marketplace operators offering payment services to facilitate
    transactions in the marketplace will also be required to hold a licence".
  - MAS's FAQ: "Service providers that process only data (e.g. payment
    instructions) and not money are treated as outsourcing services."
  - No statement by MAS or Stripe was found on a platform that only controls
    when a licensed institution pays out.
- **Confidence:** medium that this shape is safer than holding the money;
  low to medium that it needs no licence.
- **Note:** self-paced sales already use the same payment flow. What classes
  add is control of when the teacher is paid. This is an inference.
- **Confirm with:** a lawyer (question 1). The facts they need: who the
  seller of the class is in the terms; the exact Stripe flow; whether
  teachers are "merchants" under the Act; and the monthly amounts.
- **The penalty for being wrong:** for a company, a fine of up to S$250,000
  and S$25,000 a day (section 5; check against the statute).

### G10. Who sells the seat

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** the terms say the learner buys the seat from Elevate and
  the teacher teaches the class.
- **Basis:** Elevate is the business of record on the payment, and owes the
  refund in either case (G13). Selling as the seller, with Stripe as
  Elevate's payment provider, is also the reading under which Elevate is not
  processing payments for someone else (G9).
- **Confidence:** low. This is the sentence a lawyer should write.
- **Confirm with:** a lawyer.
- **Changes:** refund term 1.

## Learners

### G11. Keeping Stripe's fee on a withdrawal, and cooling-off

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** keeping Stripe's fee is acceptable when the rate is shown
  before paying. No cooling-off right applies to booking a class online.
- **Basis:** the cancellation regulations cover only direct sales, long-term
  holiday products and time-share contracts (check against the statute).
  The Consumer Protection (Fair Trading) Act makes it unfair "to do or say
  anything, or omit to do or say anything, if as a result a consumer might
  reasonably be deceived or misled" (section 4; check against the statute).
- **Confidence:** high on cooling-off; medium on the fee.
- **Confirm with:** a lawyer (question 3).
- **Changes:** the checkout page shows the rates and a worked example (G7).

### G12. A learner who attended, when the teacher cancels part-way

- **Status:** decided by the author on 2026-11-25: **Option A**, a pro-rata
  refund of the blocks not taught, by rule. The other options were a full
  refund to everyone (B) and keeping decision 3's rule (C). This changes
  decision 3.
- **Best guess:** refund the sessions that were not taught, by rule. The
  present rule, no refund unless the teacher chooses, is probably not
  enforceable.
- **Basis:** the Unfair Contract Terms Act stops a business claiming against
  a consumer to be entitled "in respect of the whole or any part of his
  contractual obligation, to render no performance at all", unless the term
  is reasonable, and the business must show that it is (sections 3 and 11;
  check against the statute). The regulator's standard contract for private
  schools refunds "in proportion to the uncompleted portion or duration of
  the Course". No Singapore case on this point was found.
- **Confidence:** medium to high.
- **Confirm with:** a lawyer (question 3).
- **Changes:** a new refund kind, `teacher_cancelled_part`: R is the price
  times the blocks not taught over all blocks, and Elevate's fee comes back
  in the same proportion. Refund term 7 and held-payout term 20.

### G13. A class that does not run after the teacher was paid

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** Elevate refunds the learner in full whether or not it can
  recover the money from the teacher, and recovers it from the teacher as a
  debt.
- **Basis:** Elevate is a "supplier" under the Consumer Protection (Fair
  Trading) Act: one who "receives or is entitled to receive money or other
  consideration as a result of the provision of goods or services to
  consumers" (section 2; check against the statute).
- **Confidence:** medium.
- **Confirm with:** a lawyer (question 4).
- **Changes:** none to the design, which does this through cancellation by
  Elevate. Refund term 8 already promises it.

### G14. A learner's location at check-in, and backups

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** tell the learner what is collected and why before the
  first check-in, and say in the privacy notice that deleted data stays in
  backups for up to 35 days. There is no right to erasure in Singapore;
  erasing on request is Elevate's choice.
- **Basis:** the Personal Data Protection Act requires telling a person "the
  purposes for the collection, use or disclosure of the personal data ... on
  or before collecting the personal data" (section 20; check against the
  statute). The regulator's guidance says archived data "will still be
  considered to be retained", and looks at whether the organisation means to
  use it and "made a reasonable attempt to destroy" it. No statement on
  backups was found.
- **Confidence:** high on notice and on erasure; medium to low on backups.
- **Confirm with:** a lawyer (question 5).
- **Changes:** none here. The check-in notice belongs to Part 1. The
  research also suggests storing "in range or not" in place of coordinates;
  that is a Part 1 design question and is not taken up here.

## Teachers

### G15. Turning the two dashboard features off for every teacher

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** email every teacher 30 days before the features are turned
  off in live mode.
- **Basis:** today's teacher agreement is one sentence about content, with
  no clause that lets Elevate change the service. A Singapore court has held
  that a power to change a contract alone "must have been expressed in the
  clearest of terms". The features are Stripe's and not promised by Elevate,
  so notice is likely enough.
- **Confidence:** medium.
- **Confirm with:** a lawyer (question 9).
- **Changes:** one rollout step.

### G16. Opting in "cannot be undone during the beta"

- **Status:** decided by the author on 2026-11-25: **Option B**, the owner
  can leave on 30 days' notice. The other options were a fixed last date (A),
  and a last date plus early release on closing the profile (C). This
  reverses decision 2c.
- **Best guess:** give the beta an end. The term is probably enforceable as
  it is, but an undefined "beta" would be read against Elevate.
- **Basis:** the Unfair Contract Terms Act controls exclusions of liability
  and claims to give no performance; a lock-in is neither. The risk is
  uncertainty. Safer drafting: a last date, a way out, and the reason.
- **Confidence:** medium to low.
- **Confirm with:** a lawyer (questions 2 and 7).
- **Changes:** a route to give notice, a job step that switches the account
  back to automatic payouts once nothing is held, and held-payout terms 4
  and 5.

### G17. On what grounds Elevate may cancel a teacher's class

- **Status:** decided by the author on 2026-11-25: **Option A**, a closed
  list of grounds, with notice where time allows. The other options were the
  same list without notice (B), and any reason Elevate thinks reasonable (C).
- **Best guess:** list the grounds, give notice and a chance to answer where
  time allows, and take back no more than was refunded.
- **Basis:** an open power to cancel may be a claim to give no performance,
  which must be reasonable under the Unfair Contract Terms Act. Comparable
  marketplace terms deduct refunds caused by the provider: not turning up,
  cancelling, breaking the rules, or fraud.
- **Confidence:** medium.
- **Confirm with:** a lawyer (question 6).
- **Changes:** Support's cancel action takes one of five grounds and a note,
  and the owner is emailed. Held-payout terms 24 to 26.

### G18. A debt that later payouts do not cover

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** the terms say the debt is set against later payouts, and
  that Elevate may ask for what remains with an itemised statement. The
  teacher keeps the right to dispute it.
- **Basis:** set-off terms are standard. Singapore cases on unfair terms
  are about clauses that take away the other side's set-off, not clauses
  that grant one.
- **Confidence:** medium to high.
- **Confirm with:** a lawyer (question 8).
- **Changes:** held-payout term 28.

### G19. Telling a teacher that Elevate keeps the fee difference

- **Status:** accepted by the author on 2026-11-25.
- **Best guess:** no duty was found; say it plainly anyway, and never call
  the estimate "at cost".
- **Basis:** no source on the point. The author decided the rule as R7.
- **Confidence:** medium to low.
- **Confirm with:** a lawyer (question 10).
- **Changes:** none. Held-payout term 14 already says it.

## Not answered

- **G20. SSG's refund rules for funded courses.** Not found. The grant flow
  is not built in this design, so nothing waits on it.
- **G21. A PayNow QR code in a real bank app after its page expired.** Only
  the sandbox is known.
- **G22. Payouts on a real connected account.** Waits for G3.
