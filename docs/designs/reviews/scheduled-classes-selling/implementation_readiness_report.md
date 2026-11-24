# Implementation Readiness Report: Scheduled Classes, Part 2 (Selling a Class)

- **Stage:** 9 (Implementation Readiness Test)
- **Target:** `docs/designs/scheduled-classes-selling.md`, lines 956-2016 (the
  Detailed Implementation Plan and its Verification Plan)
- **Reviewers:** `egm-implementation-readiness`, `egm-codebase-details` and
  `egm-style`, each in a fresh context
- **Date:** 2026-11-24

The three reports are given as the reviewers wrote them. Line numbers refer to
the target as it stood at commit `7f9cb68`. In the second report, `ROOT` is the
repository root.

| Reviewer  | Blocker | Major | Nit |
| --------- | ------- | ----- | --- |
| Readiness | 3       | 11    | 0   |
| Code      | 2       | 11    | 1   |
| Writing   | 0       | 11    | 1   |

## Readiness (`egm-implementation-readiness`)

Target: `docs/designs/scheduled-classes-selling.md`

### Verdict

Not ready. The plan fails the zero-decision rule in the places that carry money and seat state. Three problems block the build as written:

- Phases 3, 4 and 5 cannot reach their stated end check, because a Part 1 guard test forbids what Phase 3 builds and is not relaxed until Phase 6.
- The held total, the number every payout depends on, has no formula. The one formula in the tree gives wrong amounts for the new refund kinds.
- The plan does not say how a seat refund sent by the new executor is kept apart from the same refund arriving through the `charge.refunded` webhook. As written, both record it.

Below those are eleven places where the engineer would have to choose a status, a write order, a contract shape or a Stripe call, or where a verification step cannot show what it says.

Review coverage: I read the full target range, the standard, AGENTS.md and design lines 80-193 and 318-767. Part 1 was checked by grep and two excerpts. I opened code only for the files cited below.

#### 1. Blocker: Phases 3, 4 and 5 cannot pass their end check (entries 3.3, 4.3, 6.4; lines 1306-1317, 1432-1445, 1641-1644)

Quote (6.4): "no file other than `class-checkout.service.ts` and `seats.service.ts` may set `classId` on an enrollment."

- Part 1's `class-guards.test.ts` fails "if any file sets `classId` in an insert into or update of `enrollments`" (`docs/designs/scheduled-classes-attendance.md`, lines 1888-1892).
- Entry 3.3 inserts a class enrollment in Phase 3, and entry 4.3 (`move`) updates `classId` in Phase 4.
- The guard is only relaxed in 6.4, so `npx turbo run typecheck test` fails at the end of Phases 3, 4 and 5.

Suggested change: move the `classId` part of the guard change into Phase 3 (a new entry beside 3.11, allowing `class-checkout.service.ts`) and extend it in Phase 4 (allowing `seats.service.ts`). Leave only the `attendanceEventLocations` delete rule in 6.4.

#### 2. Blocker: the held total has no formula, and the existing one is wrong for seat refunds (entries 5.1, 5.6, 1.9; lines 1525-1536, 1573-1578)

Quote (5.1): "`heldByMark(tx, account)`, `heldByCalendar(tx, account, now)`"; design line 660: "Add up the teacher's share, after refunds".

- No entry says how "the teacher's share, after refunds" of one payment is computed, or where that code lives. AGENTS.md requires fee arithmetic in `money.ts`, and 1.9 adds only `seatRefund`.
- The only such function in the tree is `netAfterRefunds` in `apps/api/src/services/earnings.service.ts` (line 20), which prorates by `refundedCents / amountCents`.
- On the S$500 example it gives S$14.35 for a withdrawn seat where the refund table says 0, and 0 for a teacher-cancelled seat where the table says −S$17.50.
- Both held totals would share that arithmetic, so the mismatch check would not catch it.
- The Teach earnings totals use the same function, and no entry changes it.

Suggested change:

- Add a named function to 1.9, for example `teacherShareAfterRefunds({ teacherNetCents, seatRefunds, outsideRefundCents, disputeLost })`, with its rule per refund kind and for refunds made outside `seat_refunds`.
- State whether a negative share reduces the held total.
- Have 5.1 use it for both totals.
- Add an entry that changes `netAfterRefunds` for class payments, with a `certificates-earnings.test.ts` case per kind.

#### 3. Blocker: a seat refund is recorded twice, by the executor and by the webhook (entries 4.2, 4.4; lines 1421-1430, 1447-1458; values table line 994)

Quote (4.4): "call `applyRefund` once per refund id not yet recorded"; "a full refund sets the enrollment to the status the caller passes (default `refunded`)".

- Step 1 of `execute` creates the Stripe refund. Stripe then sends `charge.refunded`, normally before step 3 runs.
- `applyChargeRefunded` finds a refund id not yet recorded and records it first. As the code stands (`apps/api/src/services/transactions.service.ts`, lines 331-371) it uses the placeholder Stripe reason and no requester, and sends the generic `email.refund.*` notices. The executor's seat emails follow, so the learner gets two emails.
- For a full `discretionary` refund the webhook path sets the enrollment to `refunded`, while the values table says a discretionary refund "changes nothing".
- Two writers of the enrollment status are named: `applyRefund` and the executor "by the values table". Nothing says which wins.
- Nothing says whether the existing rule "only the payment the enrollment's session points at removes access" (lines 294-298) still applies to class payments. It matters when a learner withdrew and bought the same class again on the same enrollment row.

Suggested change:

- Have the executor tag each Stripe refund with `seatRefundId` metadata, and have `applyChargeRefunded` skip refunds carrying it (or skip any payment with a `pending` or `refund_sent` row). Name which.
- Give `applyRefund`'s new parameter an exact type that includes "leave the enrollment unchanged", and list the value each caller passes.
- Say whether the session-pointer check is kept for class payments.
- Add a test: the `charge.refunded` event delivered between steps 1 and 3.

#### 4. Major: refund rows in flight, and the `failed` status, have no rules (entries 3.4, 4.2, 4.3; lines 987, 1038, 1421-1445)

Quote (4.2): "`executePending()` runs `execute` for every `pending` or `refund_sent` row ... catching and recording each failure".

- `failed` is a status value, but nothing says when a row gets it. If a failure sets it, `executePending` never picks the row up again. That contradicts the 4.11 test "a failure is recorded and retried" and design line 581.
- The enrollment stays `active` until the row is `done`. A second withdrawal, or a class cancellation after a withdrawal whose Stripe call failed, writes a second row for the same payment with amounts fixed at write time.
- `refund_too_large` and `canRefundUpToCents` do not say whether rows that are `pending` or `refund_sent` count as "had back".
- The goal at line 119 says a withdrawn seat is free "at once". The plan frees it only when Stripe has answered.

Suggested change:

- State when a row becomes `failed`, or drop the value and keep `error` on a `pending` row, and which statuses `executePending` picks up.
- State that `request` refuses or reuses when the enrollment has an unfinished row, with the code.
- State that unfinished rows count toward what has been refunded.
- State whether `withdraw` sets `cancelled` in its own transaction or at `done`.

#### 5. Major: `seatRefund` is not fully defined (entry 1.9; lines 1132-1144)

Quote: "A payment already part refunded scales each amount to what remains."

Left open:

- Whether "scales" is proportional or a subtraction.
- Whether F is scaled for `learner_withdrew`.
- How X is known to be already refunded, when the only input is `alreadyRefundedCents`.
- The rounding rule for `C × R ÷ A`, and whether several discretionary refunds that sum to A must sum to exactly C.
- What the function returns for `dispute_lost`. The kind is in the values table but not in the "Refunds" table, yet `request` (3.4) takes every amount from `seatRefund`.

Suggested change: add a table in 1.9 giving R, X, `teacherChangeCents` and `platformChangeCents` for each of the seven kinds, as formulas in terms of A, F, C, the R already refunded and the X already refunded. Add the X-already-refunded input. Name the rounding (for example half up, with the last refund taking the remainder). Give one worked part-refunded case for 1.16 to assert.

#### 6. Major: the payout step leaves write order, lock scope and the 85-day mark to the engineer (entry 5.1; lines 1525-1536; design lines 650-675)

Quote: "`pay(account, held)`"; design: "idempotency key `payout:<row id>`".

- The key needs the `payout_run_accounts` row to exist before the payout is created. `outcome` has no in-progress value and its nullability is not given (1.5).
- A run that dies after the payout and before the record leaves nothing for the next run to find. The next run's row has a new id, so a new key.
- `markDue` and the held functions take `tx`; `pay` does not. It is not said whether the `for update skip locked` claim is still held during the Stripe calls. The test "two runs started together paying once" depends on that.
- "Mark any payment older than 85 days, with the reason `stripe_limit`": `release_reason` is a column on `classes` (1.3), and payments get only `releasedRunId`. It is not said where the reason goes, or whether the class and its younger payments are released too.
- It is not said that already-released classes are rescanned for a payment whose dispute was later won.

Suggested change: write the step order in 5.1:

- Insert the row with a named starting state, then call Stripe, then update it.
- Say what the next run does with a row left in the starting state.
- Say which statements are inside the claiming transaction.
- Say which row carries `stripe_limit`.

#### 7. Major: fulfilment of a class payment has undecided branches (entry 3.5; lines 1329-1340)

Quote: "apply the seat rule under 'Fulfilment'".

The existing `fulfilCheckout` (`apps/api/src/services/payments.service.ts`, lines 418-603) has branches the entry does not place:

- **Already-active enrollment.** The duplicate branch at line 504 refunds through `refundDuplicate`. The design's seat rule would read "a seat is still free, activate". It is not said which runs first, or whether a duplicate class payment goes through `SeatRefundsService`, as the 11.4 rule would require.
- **Retry path.** `retryDuplicateRefund` (line 610) can refund a recorded `seat_lost` payment through the old path, while its `seat_refunds` row is pending, if the learner has since bought the seat again.
- **Outcome value.** The `FulfilmentOutcome` for a lost seat is not named. `syncSession` returns `paid` for any outcome but `unattributed`, so the page from 7.5 shows "Your seat is booked" for a seat that was lost.
- **Cancelled class.** The rule does not check that the class is still published. A payment landing after a cancellation finds a seat free and activates an enrollment in a cancelled class.
- **Ending a hold.** What "ending a hold" writes (3.3 step 4, 4.3 cancel) is never stated: `seatHeldUntil = now`, or a status.

Suggested change: list the branches in 3.5 in order (payment already recorded; enrollment already active; class cancelled or released; hold current; seat free; seat lost), each with the row written and the outcome returned. Add a `seat_lost` (or similar) variant to `CheckoutSyncResponse` in 3.7 and a screen state in 7.5. Define "end a hold" once in the shared definitions.

#### 8. Major: contract and API changes the portals need are in no entry (entries 1.1, 4.5, 7.6, 8.4, 8.5, 9.4; lines 1063-1068, 1460-1464, 1703-1709, 1749-1766, 1801-1807)

`packages/core/src/contracts/classes.ts` is not named by any entry. It must change for:

- `classStatusSchema`, which is `z.enum(['draft', 'published'])` (line 35). Entry 1.1 adds `cancelled` only to the database enum.
- `LearnerClass`, which 4.5 says gains `seat`.

Screens that have no data source:

- 7.6 shows "cancelled and whether a refund was made". `LearnerSeat` has no field for either. It is also not said whether `GET /me/classes` still lists `refunded` and `cancelled` enrollments.
- 8.4 shows "why" a class is not on sale, its cancel reason and each refund's state. `ClassDetail` has none of these.
- 8.5 shows move targets "with the problem shown". No endpoint returns candidate classes with seats left, and `SeatView` has no payment date for the 82-day rule.
- 9.4 shows "the class, the seat's state and its seat refunds" on a transaction. No API entry extends Support's transaction detail.

Suggested change: add an entry for `contracts/classes.ts`, with the added fields on `ClassSummary`/`ClassDetail` and `LearnerClass`. Add the field or route that serves move candidates. Add an entry for the Support transaction detail, covering service and contract. Put each in the phase of the API code that fills it.

#### 9. Major: the class checkout page cannot get its data (entries 7.3, 7.4, 3.7, 3.8; lines 1676-1695, 1351-1362)

Quote: "On the web a button goes to `/checkout/class/<id>`" and "It calls `fetchQuote` with the class".

- `quoteRequestSchema` requires `courseId` (`packages/core/src/contracts/checkout.ts`, line 14), and 3.7 adds only an optional `classId`.
- The page's address carries only the class id. After a sign-in redirect it is entered cold.
- `QuoteResponse` carries no class, so "the class summary" (dates, place) has no source. Catalog lookup is by slug.

Suggested change: pick one and write it down.

- Option A: `QuoteResponse` gains `class: ClassForSale | null`, and the quote request accepts `classId` without `courseId`.
- Option B: the address is `/checkout/class/<id>?course=<slug>` and the page reads the course detail.

Also say what `/quote` answers when `courseId` and `classId` disagree. State what, if anything, changes in `sign-in-redirect.ts`: the entry lists it as modified and then says the existing pattern already covers the address.

#### 10. Major: the new tables and response types are named, not specified (entries 1.5, 1.12; lines 1096-1104, 1166-1194)

Quote (1.5): "with the columns in the Technical Plan".

The design tables give names only. Undecided:

- Column types, nullability and defaults.
- Which column holds the transfer reversal id for `dispute_lost`.
- What `requested_by` and `reason` hold for system-written rows (`seat_lost`, `dispute_lost`), and whether `requested_by` restricts or sets null.
- Who sets `class_cancellations.completed_at`.
- Whether `payout_run_accounts` has a timestamp for the "already paid today" test.
- The typed-callback form for `releasedRunId` in `commerce.ts` and `classes.ts`. `payouts.ts` imports both, and 1.2 states the form only for `classId`.

In 1.12:

- The element shapes of `mismatches`, `failedPayouts`, `classesUnderReview`, `forcedReleases` and `cancelledAfterStart` are not given.
- No field's nullability is given.
- The erase-coordinates response that 9.4 displays is not given.

Suggested change: replace the pointer with a column table per new table (type, null, default, on-delete), and write each response type out in full.

#### 11. Major: dispute and webhook-retry handling is incomplete (entries 5.3, 5.4, 5.5; lines 1546-1571)

Quote (5.5): "`retry` when the stored row has an error and no successful processing."

- `markProcessed` sets `processed_at` on failure too. A row whose handler crashed before marking has neither field set, and under this rule is a `duplicate` forever.
- `record` is shared with the Mux route (`apps/api/src/routes/webhooks.ts`, lines 27-28). Its use of the new return value is not stated.
- With retries on, the `charge.dispute.closed` handler can write two `dispute_lost` rows. Nothing makes the row unique per payment.
- 5.4's "ledger step" has no Stripe refund id to give `applyRefund`, and `refunds.stripe_refund_id` is not null and unique. The amount recorded, and the payment's resulting status, are not stated.
- "Reverse the payment's transfer in full" does not say what happens when part was already reversed.

Suggested change:

- Define `retry` as "error set, or `processed_at` null and older than N minutes", and say what the Mux route does.
- Add a unique rule for `dispute_lost` per payment.
- State what the ledger records for a lost dispute.
- State that the reversal amount is what remains.

#### 12. Major: the Stripe call for manual payouts is left to the engineer (entry 2.2; lines 1257-1260)

Quote: "the balance settings or `accounts.update` `settings.payouts.schedule.interval` (whichever the installed SDK version supports for these accounts)".

This is the call opting in depends on, and the plan asks the engineer to choose it.

Suggested change: name the one call and its parameters for the pinned Stripe SDK version, and what `stripe-provider.test.ts` asserts. Add "the switch to manual succeeds with this call" to the sandbox test's recorded results.

#### 13. Major: Phase 10 depends on a check that happens after Phase 11, and its fallback is not written (entries 10.2, 10.7, 10.8; lines 1811-1812, 1867-1881, 1998)

Quote (10.7): "If the sandbox of step 10.8 shows the schedule needs a revision, add a step that updates the schedule".

- Phase 10 says "Nothing is applied to AWS in this phase", yet 10.8 creates the schedule on staging "before 10.7 is finished".
- Rollout step 11 does 10.8 after Phase 11.
- The fallback step's command is not given, nor the deploy-role permissions it needs (`scheduler:UpdateSchedule`, `scheduler:GetSchedule`, `iam:PassRole` on the scheduler role). 10.3 adds only `ecs:RunTask`.

Suggested change: write both variants of 10.7 in full, including the IAM additions in 10.3. Move 10.8 out of Phase 10 into the rollout as the step that picks the variant, and say Phase 10 ends with the no-revision variant.

#### 14. Major: walkthrough steps 5 to 9 and rollout step 12 cannot show what they say; smaller gaps (lines 1967-2004, 1056, 1393-1400, 1480-1487)

Walkthrough:

- By step 5 the only paid seat was withdrawn in step 4, with its refund sent in that request, and the second learner never paid. The cancel dialog's counts are zero and no `teacher_cancelled` row exists.
- So step 6 ("expect the cancelled seat's refund sent") has nothing to send.
- Step 8 shows a zero held total and an empty payout list, yet the goals table cites it for "Released by a job".
- Step 9 erases zero rows.
- The fake provider keeps accounts and sessions in in-process maps (`apps/api/src/providers/payments/fake.ts`, lines 38-41), so `node dist/release.js` as a second process starts with an empty fake.
- Rollout step 12 "seeding it with past dates" cannot give a real Stripe payment, because a started class cannot be bought.

Suggested change: reorder so a second learner pays and stays, the class is cancelled with one paid seat, and the expected dialog counts are stated. Say how the release step shares the fake's state (a dev route, or a persisted fake). For staging, say to buy first and then edit the block dates in the database.

Smaller gaps:

- 4.8's refusal of a schedule change past 82 days has no error code in the tables.
- The emails table sends the owner an email when "a payout fails", but 5.3 sends none.
- 3.12's "a learner who withdrew buying the same class again" needs a withdrawal, which Phase 4 builds. Say the test sets the status directly, or move it to 4.11.
- Cancelling a class whose active seats have no payment is undefined, since `request` needs a `paymentId`. Part 1's demo seed creates 20 such enrollments.

## Accuracy against the code (`egm-codebase-details`)

Target: `docs/designs/scheduled-classes-selling.md`

All code paths below are under `the repository root`; I write that prefix as `ROOT`.

### Verdict

The plan does not pass the Implementation Readiness Standard yet. Most statements about the provider, schema, permissions, routes and Terraform files match the code. Two entries cannot be built as written: a new type named `PayoutView` collides with an existing export, and the described change to `applyRefund` does not work with how that function is written. Ten more are Major: several conflict with existing behaviour, one reinvents a per-email sign-in limit that already exists, and two affect the rollout. The review is complete for the standard, AGENTS.md and the target range; I read parts of 16 code files and did not check files that Part 1 has yet to create.

### Verified as accurate

- `ROOT/apps/api/src/providers/payments/types.ts`: `CheckoutSessionInput.courseTitle` exists; `createRefund` takes no amount; `UnconfiguredPaymentsProvider` throws from each method.
- `ROOT/apps/api/src/providers/payments/stripe.ts`: `createRefund` sends `reverse_transfer: true` and `refund_application_fee: true` (196-197); the payment page expires after 30 minutes (117), consistent with the 35-minute hold.
- `ROOT/apps/api/src/providers/payments/fake.ts`: `createRefund` always refunds the whole remainder (224-225); `refundedEvent` carries no refund ids; accounts hold no balance.
- `ROOT/apps/api/src/services/payments.service.ts`: `quoteFor` and `resolvePromo` are public; `fulfilCheckout` locks the enrollment `for update` and increments `enrolCount`; `ATTEMPT_KEYS` includes `enrollmentId`.
- `ROOT/apps/api/src/services/transactions.service.ts`: `refund` passes no idempotency key; `applyChargeRefunded` works out a difference and falls back to a made-up id (350-354).
- `ROOT/apps/api/src/services/stripe-events.ts`: four handlers only; dispute and payout events are ignored today.
- `ROOT/apps/api/src/routes/webhooks.ts`: a failed event is never handled again (53-54).
- `ROOT/packages/core/src/domain/permissions.ts`: `CAPABILITIES`, `ALL`, `MANAGER` (a filter of `ALL`), `WRITER`, `STAFF`, `UNAPPROVED`, `class.manage`, `earnings.read`, `stripe.links`.
- `ROOT/apps/api/src/lib/errors.ts`: `HttpError(status, code, message, details)`; `errors.conflict` takes no details, which matches the 409 rows.
- `ROOT/packages/core/src/contracts/errors.ts`: `USER_ERROR_CODES` has the "Classes" header (line 52).
- `ROOT/packages/db/src/schema/enums.ts`: `classStatusEnum` is `draft`, `published`, and the planned migration does not use the new value, so adding `cancelled` is safe; `enrollmentStatusEnum` already has `refunded` and `cancelled`.
- `ROOT/packages/db/src/schema/commerce.ts`, `relations.ts`, `index.ts`: `enrollments.classId` uses `(): AnyPgColumn`; the `tables` object and `export *` pattern are as described.
- `ROOT/packages/db/src/roles.ts`: default privileges (line 33) cover new tables; only the two attendance tables are restricted.
- `ROOT/apps/api/src/middleware/rate-limit.ts` and `auth.ts`: `rateLimit` has a `key` option; `requireRecentSignIn` exists; `requireRole('super_admin')` is used in `routes/support.ts`.
- `ROOT/apps/api/src/env.ts`, `tsup.config.ts`, `Dockerfile`, `src/server.ts`: `bool` helper, five entries plus comment, entry-file comment, `createDeps(env)`.
- `ROOT/infra/terraform`: `COURSE_PREVIEWS = tostring(var.course_previews)` is the pattern to copy; production `db_backup_retention_days = 7`; `github_environment_variables` has `ECS_TASK_FAMILY`.
- `ROOT/.github/workflows/deploy.yml`: the step "Register the task definition" exists.
- Learner: `fetchQuote` and `startCheckout` in `ROOT/apps/learner/src/lib/catalog.ts`; `SIGNED_IN_ONLY` has `/^\/checkout\//`; `_layout.tsx` has the signed-in group.
- Support and i18n: `layout.tsx` nav uses `t('nav.*')`; the areas `apiError`, `email`, `learnerCourse`, `learnerCheckout`, `teachSettings`, `chrome` exist; `ROOT/packages/i18n/test/catalog.test.ts` exists.

#### 1. Blocker: `PayoutView` already exists (1.12 line 1187; 1.13 lines 1196-1199; 5.6 lines 1575-1577)

- **Plan:** "`PayoutView`: `runId`, `at`, `payoutCents`, `payoutStatus`" in a new `contracts/class-sales.ts`, exported from `contracts/index.ts`.
- **Code:** `ROOT/packages/core/src/contracts/teach.ts:200` already exports `PayoutView`, the payout account view (`status`, `businessType`, `chargesEnabled`, ...), used at line 250. `ROOT/packages/core/src/contracts/index.ts` is all `export *`.
- **Effect:** a second `PayoutView` fails typecheck in Phase 1. In 5.6, `payouts: PayoutView[]` written inside `teach.ts` would silently resolve to the account type.
- **Correction:** name the new type `PayoutRecordView` (or similar) in 1.12, 5.6, 8.6 and wherever else it is used.

#### 2. Blocker: the `applyRefund` change does not fit the function (4.2 lines 1423-1428; 4.4 lines 1449-1452; 5.4 lines 1558-1560; values table line 994)

- **Plan:** "a full refund sets the enrollment to the status the caller passes (default `refunded`)", and the executor "calls `applyRefund` ... sets the enrollment status by the values table".
- **Code:** `applyRefund` in `ROOT/apps/api/src/services/transactions.service.ts:257-328`. Four conflicts:
  - **Part refunds never reach the enrollment.** It returns at 294-298 unless the payment is fully refunded. `learner_withdrew` refunds A − F (design line 557), so `cancelled` is never set by this route.
  - **No "leave it" value.** A `discretionary` refund of the full amount is a full refund and would set `refunded`, but the table says it changes nothing.
  - **Not one transaction.** It opens its own `db.transaction` (269) and takes no `tx`. The design's step 3 (record the refund, set the status, mark the row `done` together) cannot be done by calling it as it is.
  - **`dispute_lost` has no refund id.** `refunds.stripeRefundId` is `notNull().unique()` (`ROOT/packages/db/src/schema/commerce.ts:157`). 5.4's "then the ledger step" does not say what is written.
- **Also unstated:** whether the existing guard stays for class payments (only the payment whose session the enrollment points at changes the enrollment, 294-297). A withdrawn learner who buys the same class again reuses the row, because of `enrollments_one_per_class`, so one enrollment can have two payments.
- **Correction:** give `applyRefund` an optional `tx` and an explicit `enrollmentStatus: 'refunded' | 'cancelled' | 'unchanged'` that applies to part refunds too when passed. State that the session guard stays. Say exactly what `dispute_lost` records: which table, which id, and whether `payments.refundedCents` changes.

#### 3. Major: Stripe's `charge.refunded` will record seat refunds before the executor (4.4 lines 1453-1455)

- **Plan:** "call `listRefundIds` for the charge and call `applyRefund` once per refund id not yet recorded".
- **Code:** Stripe sends `charge.refunded` for refunds the API makes too. `applyChargeRefunded` (`transactions.service.ts:331-371`) records with reason "Refunded in Stripe" and then calls `sendRefundNotices` (205-251), which sends the self-paced `email.refund.*` email and the owner's "A sale ... was refunded".
- **Effect:** the executor's Stripe refund (step 1) and ledger step (step 3) are separated by a second Stripe call, or by up to 15 minutes after a failure. The webhook will often record first. The learner then gets the wrong email plus the class email, and the executor's `applyRefund` returns `false`. The plan does not say what the executor does on `false`.
- **Correction:**
  - `applyChargeRefunded` skips a refund that belongs to a `seat_refunds` row. Match on stored `stripe_refund_id`, and on refund metadata `seatRefundId` to cover the gap before the id is stored; `listRefundIds` must then return metadata.
  - The executor treats "already recorded" as success and still finishes step 3.

#### 4. Major: teacher net after a refund is pro-rata in existing code, and the plan leaves it (5.1 lines 1527-1530; 5.6 lines 1575-1577; 2.3 lines 1267-1274)

- **Plan:** held totals are "the teacher's share, after refunds"; 5.6 only adds three fields to `EarningsView`.
- **Code:** `netAfterRefunds` in `ROOT/apps/api/src/services/earnings.service.ts:20-24` returns 0 for a full refund and a pro-rata share for a part refund. It feeds `breakdown`, `forProfile`, `forCourse` and `reconcile` (172-189).
- **Effect on the S$500 example:**

  | Kind                | `netAfterRefunds` shows | Refund table says |
  | ------------------- | ----------------------- | ----------------- |
  | `teacher_cancelled` | 0                       | −S$17.50          |
  | `learner_withdrew`  | S$14.35                 | 0                 |

- **Related gaps:**
  - `seat_refunds` stores only `learner_refund_cents` and `fee_refund_to_teacher_cents`, and no function is named for the held totals.
  - `FakePaymentsProvider.listTransferAmountCents` (`fake.ts:251-260`) zeroes a whole transfer on any refund and is not in 2.3's list, so `reconcile` will disagree after a part refund.
- **Correction:**
  - Add one function in `money.ts` for a class payment's teacher net after its seat refunds (AGENTS.md: the only fee computation lives there).
  - Use it in `PayoutsService` and in `netAfterRefunds` for payments with a `classId`.
  - Store `teacherChangeCents` on the refund row, or state that it is recomputed.
  - Add `listTransferAmountCents` (fake) and `reconcile` to the entries.

#### 5. Major: a lost seat is reported to the learner as paid (3.5 lines 1331-1338; 3.7 lines 1353-1354; 7.5 lines 1699-1700)

- **Plan:** "on a lost seat write a `seat_lost` refund row ... in place of activating" and "`syncSession` adds `classId` to a paid answer".
- **Code:** `syncSession` (`ROOT/apps/api/src/services/payments.service.ts:400-408`) answers `paid` for every fulfilment outcome except `unattributed`. `FulfilmentOutcome` (42-48) has no value for a lost seat.
- **Effect:** the confirmation page would show "Your seat is booked" for a seat that was lost.
- **Two more gaps in the same function:**
  - `retryDuplicateRefund` (610-635) fully refunds any recorded payment whose enrollment is active on another session. A learner who lost a seat and bought the same class again would get that refund while the `seat_lost` row is still pending for the same payment.
  - The duplicate path for a class payment (`locked.status === 'active'`, line 504) goes to `refundDuplicate`, whose email links to `/learn/<enrollmentId>` (728). The plan does not mention it.
- **Correction:**
  - Add an outcome `seat_lost` and a sync variant for it, with a message in `success.tsx`.
  - Have `retryDuplicateRefund` ignore a payment that has a `seat_refunds` row.
  - State what a duplicate class payment does and where its email links.

#### 6. Major: `WebhookLedger.record` is shared with Mux, and "no successful processing" is not recorded (5.5 lines 1566-1569)

- **Plan:** "`record` returns one of `new`, `retry` or `duplicate`: `retry` when the stored row has an error and no successful processing."
- **Code:** `record` returns `boolean` (`ROOT/apps/api/src/services/webhooks.service.ts:12-24`) and is called by both `/mux` and `/stripe` (`ROOT/apps/api/src/routes/webhooks.ts:27-28, 53-54`) as `if (!fresh)`.
  - A string result is always truthy, so an unchanged Mux route would handle every duplicate again, and TypeScript would not complain.
  - `markProcessed` sets `processedAt` on success and on failure (26-31), so the only test for "failed" is `error is not null`.
  - An event whose handler was cut off (no `processedAt`, no error) stays a duplicate for ever.
- **Correction:** name both routes in 5.5 and say what Mux does with `retry`. Define `retry` as `error is not null`, or `processedAt is null` and older than a stated age.

#### 7. Major: the per-email sign-in limit already exists (6.1 lines 1615-1619; 6.4 lines 1647-1648)

- **Plan:** "Replace the one limiter ... with two: `rateLimit({ name: 'magic-link-email', limit: 5, ... })`" and a new test "the sixth request for one email is refused".
- **Code:** `AuthService.requestMagicLink` already refuses a sixth request per email in 15 minutes, counted in the database (`ROOT/apps/api/src/services/auth.service.ts:19-20, 54-56`, `MAGIC_LINK_MAX_PER_WINDOW = 5`). `ROOT/apps/api/test/auth.test.ts:92-104` tests exactly that.
- **Effect:** the new in-memory limiter duplicates it, and is weaker.
- **Correction:** 6.1 becomes one change, the address limit from 30 to 300 in `ROOT/apps/api/src/routes/auth.ts:14`. `sign-in-limit.test.ts` keeps only the 40-emails-from-one-address case.

#### 8. Major: a schedule that runs "the latest revision" will run Terraform's placeholder image (10.2 lines 1831-1835; 10.7 lines 1869-1872; rollout steps 12 and 14)

- **Plan:** "the release task definition without a revision", so that it runs the latest.
- **Code:** `ROOT/infra/terraform/modules/environment/api.tf:3-6, 12-13, 68`. Terraform's task definition always carries `local.bootstrap_image` (`<repo>:bootstrap`); the deploy workflow registers the real image as a later revision. The API service is protected by `ignore_changes = [task_definition]` (116-118).
- **Effect:** a release definition built the same way gets a new placeholder-image revision on every `terraform apply` that changes the environment or secrets. That includes turning `CLASS_SALES` or `CLASSES` on in steps 12 and 14. An unpinned schedule would run that revision every 15 minutes until the next deploy.
- **Correction:** make the plan's fallback the rule. The workflow sets the schedule's target to the revision it just registered, and the Terraform schedule ignores changes to the task definition ARN. Otherwise add "re-run Deploy" after every apply in the rollout steps.

#### 9. Major: `viewer` cannot be "present for a seat" with its current fields (3.6 lines 1344-1348)

- **Plan:** "`viewer` is present when the learner has a self-paced enrollment or a seat."
- **Code:** `ROOT/packages/core/src/contracts/catalog.ts:73-78` makes `viewer` `{ enrollmentId, status, completedAt } | null`, all required. `ROOT/apps/learner/src/app/course/[slug].tsx:59-65` treats `viewer.status === 'active'` as enrolled and opens `/learn/<viewer.enrollmentId>`.
- **Effect:** with a seat only, those fields have no value. Filled from the seat, an older app sends the learner to the self-paced course. This contradicts "Older apps ignore both". Part 1 (its 2.10) says only the self-paced enrollment is reported.
- **Correction:** keep `viewer` as it is (self-paced only, null otherwise) and add a top-level `viewerClassSeats: ViewerClassSeat[]`.

#### 10. Major: a move can break the unique index on enrollments (4.3 lines 1434-1441; move problems, line 995)

- **Plan:** "the enrollment and its payment are pointed at the new class".
- **Code:** `enrollments_one_per_class` is unique on (`userId`, `classId`) (`ROOT/packages/db/src/schema/commerce.ts:79-81`). Class checkout leaves rows behind: an ended hold, or a withdrawn or refunded seat.
- **Effect:** moving a learner into a class where they already have such a row fails with a unique violation. None of the six move problems covers it.
- **Correction:** add a problem such as `already_in_target`. Or define what happens to the old row; it cannot be deleted once it has a payment.

#### 11. Major: the new Stripe events are never subscribed to (5.3 lines 1548-1549; Phase 11; rollout steps 10-14)

- **Plan:** handlers for `charge.dispute.created`, `charge.dispute.closed`, `payout.paid`, `payout.failed`.
- **Code:** the subscribed events are listed in `ROOT/docs/runbooks/stripe.md:29` (`stripe listen --events ...`) and `ROOT/docs/runbooks/deploy.md:45` (the platform endpoint and the Connect endpoint). Neither file is in the plan, and no rollout step adds the events in Stripe.
- **Effect:** the handlers would never be called. Payout events belong to the connected account, so they go on the Connect endpoint.
- **Correction:** add both runbooks to Phase 11, and add a rollout step that puts the two dispute events on the platform endpoint and the two payout events on the Connect endpoint.

#### 12. Major: class checkout "reuses" pieces that are private or inline in `startCheckout` (3.3 lines 1308-1313)

- **Plan:** "reuses `PaymentsService.quoteFor` and `resolvePromo`, and builds the same payment page details as self-paced checkout".
- **Code:** `ROOT/apps/api/src/services/payments.service.ts`.
  - The details are a 13-key block inline in `startCheckout` (259-274).
  - `sameAttempt`, `ATTEMPT_KEYS`, `fulfilmentInput`, `closeReplacedSession` and `fulfilled` are private (50-67, 336-355).
  - The `below_minimum` check (215-220) is in `startCheckout`, not `quoteFor`. A promo that leaves a price above zero but under S$1 would reach Stripe unchecked.
- **Unnamed helper:** the owner-or-member check has an existing helper, `loadActor(deps, user, profileId)`, used in `ROOT/apps/api/src/services/catalog.service.ts:172`.
- **Correction:**
  - Either export one `checkoutMetadata(...)` builder and `sameAttempt` from `payments.service.ts` (a small change to that file, which the plan says stays unchanged), or state that the block is copied.
  - Add the `below_minimum` refusal to the steps and the error table; the code is already in `USER_ERROR_CODES`.
  - Name `loadActor` for `own_class`.

#### 13. Major: there is no migration task definition (10.3 lines 1841-1842; 10.7 line 1873; 10.2 lines 1833-1834)

- **Plan:** "beside the API and migration families" and "All three task definitions must run the same image".
- **Code:** only `aws_ecs_task_definition.api` exists (`ROOT/infra/terraform/modules/environment/api.tf:52`). Migrations run that family with a command override (`ROOT/.github/workflows/deploy.yml:110-118`). The deploy role's statement `EcsRunMigration` allows `ecs:RunTask` on the API family only (`ROOT/infra/terraform/modules/environment/iam.tf:128-138`).
- **Correction:** say "two task definitions". In 10.3, add the release family's ARN to `EcsRunMigration`'s resources or add a new statement with the same cluster condition. In 10.2, "a public address as the migration run uses (`assignPublicIp=ENABLED`)".

#### 14. Nit: the `owner` marker is the wrong marker (3.11 lines 1382-1384)

- **Plan:** "with `stripe.links` using the existing `owner` marker".
- **Code:** in `ROOT/apps/api/test/role-routes.test.ts:11-19`, `owner` means "`profile.edit` lets the request in, and then only the owner may do it" and is used for `PUT apply/corporate` only. The Stripe link routes use `capability: 'stripe.links'` directly (lines 85-96).
- **Correction:** the two `class-sales` POST rows use `capability: 'stripe.links'`; the GET row uses `profile.read`.

### Not verified

- Which call the installed Stripe SDK supports for manual payouts. `ROOT/apps/api/package.json` pins `stripe` at 23.1.0, so 2.2's "whichever the installed SDK version supports" can be decided in the plan; I did not check the SDK.
- The `.zh.ts` area files, and Teach's client handling of `reauth_required` in `ROOT/apps/teach/src/routes/settings.tsx`.
- Whether the route table in `docs/designs/teacher-profiles.md` (AGENTS.md, item 1.15) needs rows for the new Teach routes and `class.refund`.
- Anything in files Part 1 has not yet created (`teach-classes.ts`, `classes.service.ts`, `attendance.service.ts`, `class-view.tsx`, `learnerClass` area, `apps/learner/src/lib/classes.ts`).

## Writing (`egm-style`)

Target: `docs/designs/scheduled-classes-selling.md`

Read in full: the persona file, the word list (lines 33-50), and lines 956-2016. As instructed, I did not read the design (lines 1-955) beyond the word list. No separate standard file was supplied; I applied the plain-English standard from the task.

### Verdict

The plan is not ready to hand to an implementer as written; there are no Blockers, but twelve findings, eleven of them Major. The shared tables and most entries are direct and consistent on counts and constants. The faults cluster in three places:

- **Phase 10 and the rollout** contradict each other on order (finding 1).
- **The local walkthrough** cannot produce the result its step 6 expects (finding 2).
- **Phase 4 money entries** leave who runs a refund, what "failed" means, what a "refund row" is, and which error code to throw to the reader (findings 3-5).

About a dozen "Why" lines restate the change or cite "the author" in place of a reason. Where an entry defers to a design section ("One run", "Refunds", "Fulfilment"), that section may settle the point; I flag only what the plan's own sentences leave open.

#### 1. Major: Entries 10.7 and 10.8, Phase 10 header, rollout steps 10-11 (lines 1811-1812, 1869-1881, 1995-1999)

Quoted:

- Phase 10: "Nothing is applied to AWS in this phase."
- 10.7: "If the sandbox of step 10.8 shows the schedule needs a revision, add a step that updates the schedule to the new revision; otherwise nothing more."
- 10.8 heading: "A check before 10.7 is finished". Change: "On staging, with the author's go-ahead, create the schedule pointing at the task definition without a revision and confirm a run uses the latest revision."
- Step 10: "Apply Terraform with both new switches off. … Deploy."
- Step 11: "Do entry 10.8. Turn `release_schedule_enabled` on and apply."

What is wrong:

- **Circular order.** 10.8 sits in Phase 10 and creates a schedule on staging, but Phase 10 applies nothing to AWS. 10.7 cannot be finished until 10.8 is done, but 10.8 is done in rollout step 11, after step 10 has deployed with 10.7's workflow.
- **Step 11 is backwards.** 10.8 needs a run, and a run needs the schedule on, yet step 11 does 10.8 before turning the schedule on.
- **"Create the schedule" is already done.** Terraform creates it, switched off, in step 10.
- **The check is under-specified.** Confirming "the latest revision" needs a second deploy after the schedule exists; no step says so.
- **Two names collide.** "Sandbox" means the Stripe test at line 962. "Step 10.8" is an entry, and "step 10" is a rollout step.

Rewrite:

- 10.7: "Add `ECS_RELEASE_TASK_FAMILY` from `vars`. In 'Register the task definition', register a new revision of the release family as well. Rollout step 11 decides whether a further step is needed."
- Delete entry 10.8.
- Step 11: "Set `release_schedule_enabled = true` and apply. Expect a run every 15 minutes on the Support payouts page. Deploy once more, then read the next run's task in the ECS console. If it used the new revision, record that in `infra/README.md`. If it used the old one, add a workflow step that updates the schedule to the new revision, and deploy again."

#### 2. Major: Local walkthrough steps 3-8 and the goals table (lines 1952, 1978-1988)

Quoted:

- Step 3: "As a second learner, start checkout and stop at the payment page."
- Step 4: "Withdraw; expect the seat count on the course page to rise."
- Step 5: "Cancel the class; expect the dialog's counts".
- Step 6: "expect the cancelled seat's refund sent."
- Step 8: "expect the held total and the payout list."
- Goals table: "Released by a job, recorded per run | `payouts.test.ts`; walkthrough step 8".

What is wrong:

- **No paid seat is left to refund.** At step 5 the first learner has withdrawn, the second holds an unpaid seat, and the third was refused. The dialog counts are both zero and step 6 has nothing to send.
- **"The cancelled seat" names no seat.**
- **Steps 4, 5 and 8 state no expected value.** "To rise", "the dialog's counts" and "the held total" cannot be checked.
- **Wrong step reference.** The run is made in step 6 and its record is seen in step 7. Step 8 is the Earnings page.

Rewrite:

- Step 3: "As a second learner, start checkout and stop at the payment page. As a third, try to book; expect 'This class is full'. Then finish the second learner's payment."
- Step 4: "… Withdraw; expect the course page to show '1 seat left'."
- Step 5: "… Cancel the class; expect the dialog to say 1 learner will be refunded in full and 0 have attended, then the class shown as cancelled."
- Step 6: "Run `node dist/release.js`; expect the second learner's `teacher_cancelled` refund marked `done` and a cancellation email in the mail output."
- Step 8: state the expected held total in dollars.
- Goals table: "walkthrough steps 6 and 7".

#### 3. Major: Entries 4.2, 4.3, 4.11, 5.2 (lines 987, 1423-1428, 1441-1442, 1506-1509, 1540-1541)

Quoted:

- 4.2: "`executePending()` runs `execute` for every `pending` or `refund_sent` row, oldest first, catching and recording each failure. On `done` it calls `applyRefund` …"
- 4.11: "a failure is recorded and retried".
- 4.11: "for each kind, the two Stripe calls".
- 4.3: "`withdraw` and `refund` call `execute` after the transaction commits."

What is wrong:

- **Failure has two readings.** (a) A failure sets the row to `failed`, a value in the status table. `executePending` then never selects it, so nothing retries it, which contradicts 4.11. (b) A failure records an error and leaves the status, so it is retried. Then nothing in the plan sets `failed`.
- **"On `done` it" is unclear.** "It" could be `execute` or `executePending`, and "on `done`" could mean "when the row reaches `done`" or "if the row is already `done`".
- **No entry names the caller of `executePending()`.** 4.3 covers only `withdraw` and `refund`. 5.2 says `release.ts` calls `PayoutsService.run()`. The reader cannot tell what sends a cancellation's refunds in Phase 4.
- **"For each kind" overreaches.** It includes `dispute_lost`, which has one Stripe call and is not built until 5.4.

Rewrite for 4.2: "`execute(id)` reads the row's status and resumes from it: the three steps under 'How a refund is sent'. When the last step succeeds, `execute` sets the row to `done`, calls `applyRefund` with Stripe's refund id, sets the enrollment status from the values table, writes the audit entries and sends the emails. When a step throws, `execute` records the error on the row and [leaves the status / sets `failed`: choose one, and say what retries a `failed` row]. `executePending()` runs `execute` for every `pending` or `refund_sent` row, oldest first. It is called by [name the caller]."

Rewrite for 4.11: "for each kind except `dispute_lost` (Phase 5)".

#### 4. Major: Entry 4.8 against the error tables; `classOnSale` (lines 1019, 1036, 1148-1150, 1223, 1393, 1482-1485, 1756-1757)

Quoted:

- 4.8: "`publish`, `update`, `remove` and `setInstructor` refuse a cancelled class with `class_not_published`. `update` refuses to move a block of a class with a seat sold so that its last block ends more than 82 days after the class's earliest payment."
- Table: "Cancelling a class that is not published | 409 | `class_not_published`".
- Table: "`classOnSale` is false".
- 1.10: "returning `true` or the reason".

What is wrong:

- **One code, five conditions.** The table gives `class_not_published` one condition; 4.8 uses it for four more.
- **No code for the second refusal.** The 82-day refusal names no status or code, and the table has none.
- **The second sentence must be read twice.** "So that" reads as purpose. It also writes 82 where the table has `MOVE_HORIZON_MS`.
- **`classOnSale` never returns false.** By 1.10 it returns `true` or a reason.
- **The reasons are not listed.** 1.16, 3.12 and 8.4 each need "each reason", but the shared tables list move problems and not sale reasons.

Rewrite:

- Table row: "Cancelling, publishing, editing, deleting or re-assigning a class that is cancelled or not published | 409 | `class_not_published`".
- New table row: "A schedule change that would end the class more than `MOVE_HORIZON_MS` after its earliest payment | 422 | `<code>` | `latestEndsAt`".
- 4.8: "`update` refuses a block change when the class has a sold seat and the change would make its last block end more than `MOVE_HORIZON_MS` after the class's earliest payment."
- Values table: add a "Not-on-sale reasons" row.
- Error table: "`classOnSale` returns a reason".

#### 5. Major: Entry 4.4 (lines 1449-1456; compare 1335, 1440-1441)

Quoted: "`refundedCents` is set to the sum of the payment's refund rows, computed inside the locked transaction. `applyChargeRefunded`: call `listRefundIds` for the charge and call `applyRefund` once per refund id not yet recorded".

What is wrong: "refund row" has two meanings.

- In 3.5 and 4.3 it is a `seat_refunds` row.
- Here it cannot be. A Support or dashboard refund writes no `seat_refunds` row, yet it must count toward `refundedCents`.
- "Not yet recorded" does not say where a refund id is recorded.

Rewrite: "`refundedCents` is set to the sum of the payment's rows in `<table>` (one row per Stripe refund id), computed inside the locked transaction. `applyChargeRefunded` calls `listRefundIds` for the charge, and calls `applyRefund` once for each refund id that has no row in `<table>`." Keep "seat refund row" for `seat_refunds` throughout.

#### 6. Major: Entry 3.5 (lines 1331-1338; emails table 1049-1050)

Quoted: "With none, nothing changes. With one: lock the class row before the enrollment row; apply the seat rule under 'Fulfilment'; store `classId` on the payment; skip the `enrolCount` increment; on a lost seat write a `seat_lost` refund row through `SeatRefundsService.request` in place of activating; and send the class receipt in place of the course receipt."

What is wrong: the list has two readings.

- (a) Every class payment gets the class receipt, including one whose seat was lost. That learner then gets a receipt and later a `seatLost` email.
- (b) The receipt is sent only when the seat is activated.

The emails table ("A class payment is fulfilled") does not settle it. There is also a stray line break after "activating;".

Rewrite: "If the payment page's details have no `classId`, `fulfilCheckout` behaves as today. If they have one: lock the class row, then the enrollment row. Store `classId` on the payment. Do not increment `enrolCount`. Apply the seat rule under 'Fulfilment'. If the seat is still free, activate the enrollment and send the class receipt, not the course receipt. If the seat was lost, do not activate; write a `seat_lost` row through `SeatRefundsService.request` and send no receipt."

#### 7. Major: Entry 5.7 (lines 1582-1583; compare 9.2, line 1791)

Quoted: "Add `GET /payout-runs`, answering `SupportPayoutsOverview`, and `POST /classes/:id/clear-review`, with `requireRole('super_admin')`."

What is wrong: the last clause has two readings.

- (a) Both routes need `super_admin`.
- (b) Only the POST does.

9.2 suggests (b): the page is open to Support and only the button is for a Support admin. The entry must say so, because this is an access rule.

Rewrite: "Add `GET /payout-runs`, answering `SupportPayoutsOverview`, for any Support user. Add `POST /classes/:id/clear-review`, with `requireRole('super_admin')`."

#### 8. Major: Entries 1.9 and 1.10 (lines 1141-1143, 1154-1155)

Quoted:

- 1.9: "A payment already part refunded scales each amount to what remains."
- 1.10: "`payoutCents({ availableCents, pendingCents, heldCents })`, the smaller of available and available plus pending less held, never below zero".

What is wrong:

- **1.9 has two readings.** (a) Each output is multiplied by remaining ÷ original. (b) Each output is capped at what remains. They give different cents. Rounding is not stated either, although 1.16 tests that the three outputs account "for every cent".
- **1.10 must be read twice.** "Available and available plus pending less held" runs three operands together.

Rewrite:

- 1.9: "When `alreadyRefundedCents` is above zero, each output is multiplied by (`amountCents − alreadyRefundedCents`) ÷ `amountCents` and rounded [state the rule], with any rounding remainder given to [state which output]." Or state the cap, if that is the rule.
- 1.10: "`payoutCents(...)` returns `min(availableCents, availableCents + pendingCents − heldCents)`, or 0 if that is negative."

#### 9. Major: Sandbox test paragraph and rollout steps 10, 12, 14 (lines 962-969, 1995-1997, 2000, 2011-2012; compare 1816, 1848)

Quoted:

- "If the sequence is refused, stop and take the fallback in 'Refunds' to the author."
- "Record whether each call succeeds".
- Step 10: "Apply Terraform with both new switches off. Confirm production's plan shows backup retention changing to 35 days and nothing else unexpected. Copy the GitHub variables."
- Step 12: "Turn `CLASS_SALES` on for staging."
- Step 14: "turn on the schedule, then `CLASSES`, then `CLASS_SALES`."

What is wrong:

- **The fallback sentence has two readings.** (a) Adopt the fallback and tell the author. (b) Stop and ask the author whether to adopt it.
- **"Record" names no place and no person.**
- **Step 10 mixes environments.** It sits under a staging heading but checks production's plan, and does not say which environment "Apply" means.
- **"Nothing else unexpected" gives no list.** The reader has no statement of what is expected (the release task, the queue, the role, the schedule).
- **"Copy the GitHub variables" names no source or destination.**
- **The switch has two names.** `CLASS_SALES` is the API variable; the operator sets Terraform's `class_sales`. Step 11 uses the Terraform name and steps 12 and 14 use the API name. No step says whether a deploy is needed for the change to reach the running task.

Rewrite:

- Sandbox: "The implementer records each result in `<file>`. If Stripe refuses any call, stop work and ask the author whether to adopt the fallback described under 'Refunds'."
- Step 10: "In `envs/staging`, apply with `class_sales` and `release_schedule_enabled` both false. Copy the `github_environment_variables` output into the staging GitHub environment's variables. Deploy. Separately, run `plan` in `envs/production` and confirm it shows only: the release task definition, the queue, the scheduler role, the schedule, and backup retention 7 to 35."
- Step 12: "Set `class_sales = true` in staging, apply, and deploy."
- Step 14: use the Terraform names.

#### 10. Major: One thing with several names, and defined words used with a second meaning (lines 1239, 1267, 1310-1314, 1331-1332, 1402, 1661, 1682, 1791, 1891, 1978, 1980)

Quoted and what is wrong:

- **Session / payment page / details.** "`CheckoutSessionInput`" and "Sessions track" (2.1, 2.3) against "builds the same payment page details" (3.3), "the payment page's details" (3.5) and "stored details" (3.12). "Payment page details" appears to mean the Stripe checkout session's metadata, but is never defined. "Details" is also the error tables' column and `HttpError`'s argument.
- **Release.** 3.3 has "the services that move and release seats". The word list defines Release as a class's money ceasing to be held; elsewhere a seat is "freed". 9.2's "Release" button calls `clearReview`, which by 5.1 only "sets the review-cleared fields"; the release happens on a later run.
- **Route.** 11.1 has "the held total, the two routes and the mismatch rule". Everywhere else "route" is an HTTP route; here it seems to mean the two ways of totalling held money (`heldByMark`, `heldByCalendar`).
- **App.** "The installed app" (7.3), "native" (7.1) and "in the app" (walkthrough step 4) leave open whether step 4 is done on the web or in the installed app.

Rewrite:

- Define once in the shared definitions: "Payment page: Stripe's hosted checkout session. Its details: the session's `metadata`." Use "payment-page metadata" in 3.3, 3.5 and 3.12.
- 3.3: "the services that move and free seats".
- 9.2: label the button "Clear review", or add "(the class is released on the next run)".
- 11.1: "the held total, its two calculations (by mark and by calendar) and the mismatch rule".
- Step 4: "open the class on the web".

#### 11. Major: "Why" lines that give no reason, cite authority, carry an instruction, or overstate (lines 1164, 1210-1211, 1263, 1326-1327, 1362, 1464, 1478, 1519, 1535-1536, 1544, 1554, 1666-1667, 1709, 1730-1731, 1747, 1807)

Quoted and what is wrong:

- **Restates the change.** 2.2 "The real provider." 3.8 "The new endpoint; the self-paced one is untouched." 4.5 "The learner's side of withdrawing." 4.7 "Elevate's own cancellation." 5.2 "The program the scheduled task runs." 7.6 "Where a learner manages their seat." 8.3 "Where a profile opts in." 9.4 "The three Support actions this design adds."
- **Cites the author, not a reason.** 1.11 "The author decided only the owner and managers grant a refund." 5.1 "The author's payout design: …". 5.3 "The author's dispute rule". 4.11 "These are the author's refund rules".
- **An instruction inside a Why.** 1.15 and 7.1 "The Chinese text needs the author's sign-off." 8.1 "The terms need a lawyer and the Chinese needs the author's sign-off." None says who obtains it, or whether the phase waits. Step 14 shows it gates production only.
- **Overstated claim (CALIBRATE).** 3.4 "which is safe because no environment has `CLASS_SALES` on before the whole plan is built". 3.1 adds `CLASS_SALES=true` to `.env.example` and 3.11 defaults it to `'true'` in tests, so local and test environments have it on from Phase 3.

Rewrite examples:

- 2.2: "The fake covers tests only; staging and production call Stripe through this file."
- 4.7: "Elevate must be able to end a class the teacher cannot or will not cancel, and that cancellation refunds attended learners too."
- 1.11: "A refund spends the profile's money, so only the roles that already manage its money may grant one."
- 5.1: "Paying the balance less the held total means a miscounted class cannot be paid out early; the second total catches a miscount."
- 8.1: move the note out of "Why" to a line "**Before production:** a lawyer reads the terms; the author approves the Chinese text (rollout step 14). Neither blocks this phase."
- 3.4: "no deployed environment has `CLASS_SALES` on before Phase 4 is merged".

#### 12. Nit: Entry headings that do not match the entry (lines 1278, 1639, 1688-1694, 1692, 1875; stray breaks at 1336-1337 and 1716-1717)

Quoted and what is wrong:

- **7.4 lists a file it does not change.** The heading gives "`apps/learner/src/lib/sign-in-redirect.ts` (Modify)", but the Change says "`/^\/checkout\//` in `SIGNED_IN_ONLY` already covers its address".
- **7.4 misnames a table.** "The learner error table" is titled "Learner-facing errors".
- **10.8 is not a file.** Line 977 says "Each entry is one file unless it says otherwise". The heading carries no Create or Modify, and the one file 10.8 writes (`infra/README.md`) is entry 11.5's.
- **2.4 and 6.4 break the heading form.** They use "and a new …" where 1.16, 3.12, 4.11 and 5.8 use "(Create n, modify n)".
- **Two test files share a name.** 3.12's `class-sales.test.ts` (API) and 1.16's (core). The goals table marks only some uses with "core" (lines 1950, 1955).
- **Stray line breaks.** Mid-sentence in 3.5 and 7.7.

Rewrite:

- 7.4 heading: "`apps/learner/src/app/checkout/class/[classId].tsx` (Create) and `apps/learner/src/app/_layout.tsx` (Modify)". Body: "`sign-in-redirect.ts` needs no change: …".
- 2.4 heading: "Tests in `apps/api/test/` (Modify one, create one)".
- 6.4 heading: "Tests in `apps/api/test/` (Modify two, create one)".
- Goals table: write "API `class-sales.test.ts`" or "core `class-sales.test.ts`" at every use.
- 10.8: see finding 1.
