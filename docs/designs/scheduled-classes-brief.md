# Scheduled Classes and Attendance

- **Author:** skypad123
- **Date:** 2026-11-24

## Overview

Elevate sells self-paced online courses today. This concept adds **classes**: a
teaching profile runs a live course at a fixed time, with one instructor and a
limited group of learners, either at a venue or remotely.

Words used in this brief:

| Word       | Meaning                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| Class      | One scheduled run of a live course: dates, an instructor, up to N seats, a venue or "remote". |
| Time block | One period of a class in which attendance is taken once. The default is one block per day.    |
| Seat       | One learner's place in one class.                                                             |
| Check-in   | The learner recording their own attendance for a time block.                                  |
| Day view   | The Teach portal screen the instructor uses while a class is running.                         |

What the author asked for:

- **Teach portal.** Create a class schedule for a single-day or multi-day class,
  save it as a draft, then publish it. Run the day from a day view that shows
  attendance and controls which materials the class can open.
- **Learner app.** A learner who is in a class checks in, then lands on a class
  page with their progress and the class materials.
- **Reminders.** Email and mobile push reminders for classes and attendance.

Attendance is built first. The author expects the record to matter later for
refund decisions and for SkillsFuture (SSG) grant claims. The target is a beta
at the start of 2027, about five weeks from the date of this brief.

Seven independent reviewers examined the concept. Their findings are below.
The concept as stated does not fit five weeks, and eight findings need a
decision before any schema is written.

**Status after the review (2026-11-24).** The author has answered three
findings. Blockers 1 and 6 are resolved by taking the reviewers' alternatives.
On Blocker 4 the author decided that a live class is a separate package from
the self-paced course and the two are not mixed: a class is sold at the course
price on the existing course page, only through checkout, and a learner may own
both packages with separate progress and separate certificates. A cancelled
class gives a partial refund and, if the teacher allows it, access to that
class's materials. Three reviewers then re-checked these decisions; their
findings are under "Second review".

The author answered the second review on the same day:

- Class payments are held and the teacher is paid after the class, not at the
  moment of sale. The money waits in the teacher's own Stripe account with
  payouts paused, and new infrastructure releases it. How this fits a later
  grant process is still to be worked out with the author.
- A class purchase opens only what that class gives. It never opens the
  self-paced course.
- The party that ends a seat bears Stripe's processing fee, so Elevate does not
  lose money on a refund it did not cause. A learner whose class is cancelled by
  the teacher is refunded in full. The author first chose "amount paid less
  Stripe's fee" for every case and changed it after the consumer-rules check.
- A flagged check-in counts as present at once, and the instructor overturns a
  wrong one.
- A manual mark counts at once, and the learner has a fixed number of days to
  say "this was not me".

These answers have not been reviewed. What remains open is listed under "Open
decisions".

## Analysis

### Reviewer status

| Lens                                 | Reviewer                       | Status    |
| ------------------------------------ | ------------------------------ | --------- |
| Contrarian / YAGNI                   | `egm-zoom-out`                 | completed |
| Cost, quota and architecture         | `egm-design`                   | completed |
| Observability and operations         | `egm-codebase-details`         | completed |
| UX and ergonomics                    | `egm-comprehension`            | completed |
| Migration and backward compatibility | `egm-implementation-readiness` | completed |
| Long-term tech debt and maintenance  | `egm-structural`               | completed |
| Inventive catalyst                   | `egm-inventive-catalyst`       | completed |

Repository claims marked "checked" were confirmed against the code after the
reviews. Claims about outside rules are listed under "Not verified".

### Blockers

**1. Identity document images (raised by five lenses).**
Marking attendance by hand requires a photo of the learner and an image of an
identity document. Who may view these and how long they are kept is undecided,
and the current storage cannot keep them safely.

- An upload of kind `image` is stored under a public key
  (`apps/api/src/services/media.service.ts` lines 27-32, checked). Public files
  are cached as immutable.
- The production bucket keeps old versions of deleted files. The only rule that
  removes old versions covers `public/previews/`
  (`infra/terraform/modules/environment/storage.tf`, checked). A "deleted"
  identity image would stay in storage.
- `media_assets` has no retention date and no record of who viewed a file.
- Singapore's privacy regulator has guidance against keeping copies of identity
  cards unless a law requires it. Nobody has checked the current wording.
- The Teach portal is a web page on a laptop. The concept does not say how an
  instructor photographs a learner and a document from it.

_Resolved by the author after the review:_ no image is stored. For a manual
mark the instructor records that an identity document was checked, its type and
a reason, and the learner confirms the mark from their own account.

**2. The attendance record has no home (five lenses).**
The existing placeholder is a list inside the enrollment row
(`packages/db/src/schema/commerce.ts` lines 28-46, checked). It cannot be
audited:

- The list is rewritten whole, so an entry can be changed or lost with no trace.
- It has no field for who recorded an entry, why, or what evidence there was.
- Its methods are `qr | gps | manual`, which treats location as an alternative
  to the code. In this concept location is a second check on top of the code.
- The enrollment row is deleted when its user is deleted, and the list with it.
- Application logs are kept for 90 days in production, so they cannot be the
  evidence either.

**3. A refused check-in leaves no trace, and Support cannot see a class in trouble.**
The API returns expected errors without logging them, and the request log has
no user, class or reason. Thirty learners failing at once would appear as thirty
identical lines. The Support portal has no class or attendance screen. No app
shows the request ID that the API already returns.

**4. Where a seat lives, and what it does to checkout (four lenses).**

- One learner can have only one enrollment per course
  (`commerce.ts` line 55, checked), and checkout refuses a learner who already
  has one (`apps/api/src/services/payments.service.ts` line 145, checked). A
  learner who bought the course self-paced cannot join a class. The early
  playtest users are likely to be these people.
- A Stripe checkout session stays open for 30 minutes
  (`apps/api/src/providers/payments/stripe.ts` line 117, checked). If seats are
  counted only when payment completes, two learners can pay for the last seat.
- The losing learner can only be refunded, and Elevate absorbs Stripe's fee on
  refunds (`docs/adr/003-payments-destination-charges.md` line 22, checked).
- Adding a class choice touches five places in the payment code: session reuse,
  the free-course path, late payment events, deploy and rollback, and refunds.

_Author's decision after the review:_ a live class is a different package from
the self-paced course, and the two are not mixed. A self-paced enrollment does
not give a place in a class. This rules out the reviewers' suggestion to fill
the first class lists from existing self-paced enrollments. The seat hold and
the payment-code risks above still apply.

What the decision means in the code, checked after the review:

- Progress, quiz attempts and certificates all hang off the enrollment row
  (`packages/db/src/schema/learning.ts` lines 21, 42, 60). Separate progress and
  a separate certificate for a class therefore mean the class purchase is its
  own enrollment row.
- That needs the one-enrollment-per-course rule to change, and every lookup
  that finds "the learner's enrollment for this course" to say which one it
  means. The reviewers advised against a second enrollment because of that
  rule; they did not review this decision.
- The only refund action Support has today is a full refund that removes access
  (`apps/api/src/services/transactions.service.ts` line 163). Partial refunds
  are recorded only when they arrive from Stripe. A partial refund for a
  cancelled class is new work.

**5. Whether check-in works in a browser decides the whole design (four lenses).**

- The native app sends paid checkout to the website
  (`apps/learner/src/app/checkout/[courseId].tsx` line 86, checked). Most paying
  learners are therefore web users already.
- The learner app has no camera or location library. Adding them needs a new
  native build and store review, not an over-the-air update, inside a window
  that crosses the year-end holidays.
- The API cannot tell an old app version from a new one, and has no way to ask
  a learner to update.

**6. Location as a hard gate makes the bypass form the normal path (four lenses).**
Indoor location readings are often tens of metres off, and the reading is
reported by the phone, so it can be faked. If a check-in is refused until the
instructor bypasses it, every failure queues at one person during the first ten
minutes of class. Learners have no message telling them what to do next.

_Resolved by the author after the review:_ location is evidence, not a gate.
The check-in is accepted and the reading is stored. A missing, refused or
out-of-range reading is flagged in the day view, and the instructor clears the
flag per learner with a reason.

**7. "Only what the teacher shared" breaks progress and certificates (five lenses).**

- Lesson locking is checked in at least three places in
  `apps/api/src/services/learning.service.ts` (lines 170, 279, 327, checked),
  and again in several learner app screens.
- A course is complete only when every lesson is complete
  (`packages/core/src/domain/lesson-state.ts` line 87). A class learner shown six
  of ten lessons can never complete the course or earn a certificate.
- The "continue where you left off" target would point at lessons the class
  learner cannot open.
- The concept does not say what a class learner can open before check-in, when
  absent, or after the class ends. This changes what is being sold.

**8. The scope does not fit five weeks and contradicts the product spec.**
`docs/spec.md` line 63 lists class scheduling, QR/GPS attendance and native apps
as out of scope. The concept is about seven new parts: scheduling, seat-limited
checkout, rotating-code check-in, location checks, the override ladder with
evidence, class materials, and change notices. "Attendance first" as described
still depends on a class, its time blocks and a list of learners existing.

### Major findings

| Finding                                           | Detail                                                                                                                                                                                                                                                           | Lenses                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A cancelled class reverses money already paid out | The teacher's share moves at the moment of sale (`stripe.ts` line 108, checked) and losses fall on the platform (line 39, checked). A class sold weeks ahead and then cancelled means N refunds against an account that may be empty.                            | Design, Inventive, YAGNI                       |
| How the rotating code is made                     | A code held in server memory breaks on every deploy. Six typed characters can be guessed unless attempts are limited, and the current limiter resets on restart. A code can be relayed to someone outside the room, and for remote classes it is the only proof. | Design, Operations                             |
| The day view has no way to update                 | The codebase has no server push. A view that silently stops updating will make the instructor mark learners by hand who did check in.                                                                                                                            | Design, Operations                             |
| "Told by app" has nothing to land in              | There is no notification table, no push library and no job queue. Emails are sent one at a time inside the request, so a failure part-way leaves some learners untold with no record of which.                                                                   | Design, Operations, Migration, Maintenance, UX |
| Time blocks as settings, not records              | If the block size, the dates or the time zone change after check-ins exist, past check-ins change meaning. No table stores a time zone today.                                                                                                                    | Operations, Migration, Maintenance             |
| "Any member can be the instructor"                | Roles are owner, manager and writer. A writer cannot publish course edits, yet could override attendance. The permission check cannot express "assigned to this class".                                                                                          | YAGNI, Maintenance, Migration                  |
| A third draft-and-publish mechanism               | Courses have draft, pending review and live. Change sets have open, approved and discarded. A class schedule would add draft and published with different rules and the same words.                                                                              | Maintenance                                    |
| Shared lessons tie the class to the course editor | A live lesson can be deleted on the assumption that nothing else refers to it. A lesson shared with a running class would either block that delete or disappear mid-class.                                                                                       | Maintenance, Migration                         |
| Two scans on funded courses                       | SSG-funded courses must take attendance through the Singpass app. Elevate's check-in is then a second scan in the same room and cannot be the grant evidence.                                                                                                    | YAGNI, UX, Inventive, Maintenance              |
| No way back for the database on deploy            | Migrations run before the service restarts and there are no down migrations. Dropping or renaming an enrollment column in the same release would break the previous version.                                                                                     | Migration                                      |
| The day view mixes public and private             | The instructor's laptop is often on the projector. The code must be visible to the room; names and forms must not be.                                                                                                                                            | UX                                             |
| Proof that learners were told                     | The mailer returns nothing and stores nothing. A learner who missed a moved class cannot be shown to have been notified.                                                                                                                                         | Operations                                     |

### Contradictions and the transforms that remove them

The inventive lens looked for trade-offs the concept accepts as unavoidable.
Other lenses reached several of the same answers independently.

| Contradiction                                                 | Transform                                                                                                                                                                                                                                                                                                                                  | What it costs                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stronger proof for a hand mark versus storing identity images | Record the check, not the document: the instructor states "I saw a photo ID of type X" with a reason, and the learner confirms from their own account.                                                                                                                                                                                     | No image exists if a dispute comes later. Some learners never confirm, so the record needs a "manual, unconfirmed" state.                                                  |
| A strict record versus a class that must go on                | Record evidence and do not gate on it. Every check-in stores what was observed: code matched, location reading and accuracy, or "refused". A weak reading shows as a flag the instructor clears with a reason.                                                                                                                             | "Present" becomes a judgement made when the record is read. Instructors may clear flags without looking; the record shows that they did.                                   |
| In-app scanning versus build cost and web learners            | The QR code is an ordinary web link. Any phone camera opens it in the learner web app, and the browser can ask for location. The 6-character code is the same value typed by hand.                                                                                                                                                         | Browser location is coarser. A signed-out learner must sign in by emailed code at the door.                                                                                |
| Never oversell versus no scheduler to release seats           | A seat is its own row with an expiry equal to the checkout session's. Seats taken are paid seats plus unexpired holds, counted when read.                                                                                                                                                                                                  | An abandoned checkout can make a class look full for up to 30 minutes.                                                                                                     |
| A rotating code versus no scheduler and one server            | Derive the code from a secret stored per time block and the server clock. Any server process can check it and nothing needs to be stored per rotation.                                                                                                                                                                                     | The server must also accept the previous time window to allow for typing.                                                                                                  |
| Teacher control versus the course's own progress tracking     | Keep one locking function and change where the lock comes from. For a class learner, "not yet shared" is the only reason a lesson is locked, and progress still counts every lesson.                                                                                                                                                       | The lock message needs a second wording. A rule is needed for what opens when the class ends.                                                                              |
| "Attendance first" versus its dependency on checkout          | Split attendance from payment. In the first slice the teacher fills the class list from learners already enrolled in the course. Picking a class at checkout comes second, using the same seat table. **Ruled out by the author after the review: the packages are not mixed.** The contradiction stands until open decision 1 is settled. | Pay-and-pick in one flow arrives second. Until then the teacher enforces capacity by hand.                                                                                 |
| Paying the teacher at once versus refunding a cancelled class | A cancelled class releases the seat and offers another class. Refunds are handled by Support. The reviewer also proposed offering self-paced access, **which the author ruled out after the review.**                                                                                                                                      | With no self-paced fallback, more cancelled seats end in a refund. Holding the teacher's money until the class has run is the fuller answer and changes the payment model. |

### Ideal Final Result

Described without regard to the five-week limit:

- Check-in works on any phone with a browser. No app-store release sits on the
  critical path.
- Every check-in attempt, pass or fail, is one row in a table that is only ever
  added to. A correction is a new row pointing at the one it replaces.
- "Present" is worked out from those rows. Each row says how it was captured, so
  a Singpass record can sit beside Elevate's own later and a funded class never
  asks a learner to scan twice.
- The class never waits on a phone. Weak evidence is flagged, not refused.
- Elevate stores no identity document image.
- A seat hold is the unpaid checkout itself and disappears on its own.
- Progress and certificates work the same for class and self-paced learners.
- Cancelling a class releases seats, sends notices and offers another class.
  What it does to money is an open decision.

### Second review: the decisions made after the first review

Three reviewers re-checked only the changed parts: the separate class package,
checkout as the only way in, two enrollments for one course, the cancelled-class
refund, location as evidence, and the manual mark with learner confirmation.

| Lens                                 | Reviewer                       | Status    |
| ------------------------------------ | ------------------------------ | --------- |
| Cost, quota and architecture         | `egm-design`                   | completed |
| Migration and backward compatibility | `egm-implementation-readiness` | completed |
| UX and ergonomics                    | `egm-comprehension`            | completed |

**Verdict.** Making a class purchase its own enrollment row is workable, and the
migration lens judged it safer than a separate seat table that owns progress.
It holds only under the conditions in findings R3 and R4. The money side of a
cancelled class is not settled.

**R1. Blocker: who funds the refund for a cancelled class.**
The teacher's share is paid at the moment of sale, and a class is sold weeks
before it runs. By the time a class is cancelled the money has usually left
Stripe. A refund pulls it back from the teacher's Stripe balance; if that is
empty, the shortfall is Elevate's loss, because accounts are created with losses
borne by the platform (`stripe.ts` line 39, checked). The teacher's own action,
cancelling, triggers it. An example with the default rates and a S$500 seat:

| Item                                       | Amount        |
| ------------------------------------------ | ------------- |
| Stripe's fee                               | S$17.50       |
| Elevate's commission                       | S$72.38       |
| Teacher's share, paid at sale              | S$410.12      |
| Clawback for a cancelled class of 20 seats | about S$8,200 |

The reviewer's options:

- (a) For class sales, hold the money on the platform and pay the teacher after
  the class has run. This changes the payment decision record for classes.
- (b) Keep paying at sale, but delay payouts on accounts that sell classes until
  after the class date.
- (c) For the beta only, accept the exposure with a written cap: few named
  teachers, a ceiling on price and class size, cancellation by Support only.

_Author's decision:_ hold the payment. The teacher is not paid at the moment of
a class sale. Where the money sits while it is held, what releases it, and how
this fits a later grant process are open decision 1.

**R2. Blocker: "a full class cannot be picked" is a check, not a guarantee.**
The seat is checked when the learner picks, and payment can complete up to 30
minutes later. Fulfilment locks only the learner's own enrollment row, so two
payments for the last seat both succeed. Also, a promo code that makes the price
zero enrolls with no payment at all (`payments.service.ts` line 166, checked),
which contradicts "nobody is placed in a class without a sale".

**R3. Blocker: the code assumes one enrollment per learner per course in about
a dozen places.** Dropping the rule is not enough, and dropping it outright
would allow duplicate self-paced purchases, because that rule is the only thing
stopping them.

- Checkout finds "the learner's enrollment" by learner and course, with no
  ordering (`payments.service.ts` line 141). With two rows it picks either.
- Two checkout attempts count as the same when enrollment, payee, promo, amount
  and language match (`payments.service.ts` lines 51-57, checked). Class is not
  in the list, and classes share the course price. A learner who opens checkout
  for one class, goes back and picks another is sent to the first class's
  payment page.
- The course page reads one enrollment per viewer
  (`apps/api/src/services/catalog.service.ts` line 162, checked), and has one
  button. A learner who owns one package has no route to the other.
- A second payment on an active enrollment is refunded automatically with a
  "you paid twice" email.
- The enrol counter, the "popular" sort, the analytics totals and Support's
  person view count rows, so a learner with both packages counts twice.

**R4. Blocker: a class purchase would open the whole self-paced course.**
The enrollment's `mode` column is read by no code (checked). The player and the
certificate check only that the enrollment is active. A class enrollment would
therefore open every lesson and can earn the self-paced certificate: pay once,
get both. The same applies to the cancelled-class switch. If "that class's
materials" are the course's own lessons, a cancelled class sells the self-paced
course for the price minus the refund. An installed older app would also open a
class enrollment in the self-paced player.

_Author's decision:_ accepted. What a class purchase lets the learner open is
checked wherever an enrollment is loaded, and it is never the self-paced
course.

**R5. Blocker: an older version of the API is unsafe once one class sale
exists.** There are no down migrations and each deploy runs the old and new
versions side by side. The migration lens requires two production releases:
the first adds the tables, the narrowed rule and the class-aware lookups with
class selling switched off; the second switches it on. After the first class
sale, no version older than the first release may be deployed again.

**Major findings from the second review**

| Finding                                            | Detail                                                                                                                                                                                                                                                                     | Lens              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A partial refund cannot be made today              | The refund call takes no amount (`stripe.ts` line 187, checked), so it always refunds everything. The test double can only refund in full, so no test can cover a partial refund yet.                                                                                      | Design, Migration |
| Only one split is possible without new money rules | Stripe splits a partial refund in proportion between the teacher's share and Elevate's fee, and keeps its own fee. On the S$500 example Elevate breaks even at about 80% refunded and loses S$17.50 a seat at 100%. The teacher who cancelled keeps a share of every seat. | Design            |
| A partial refund may be counted twice              | The reviewer's reading of the refund code is that the action and Stripe's notice can each record the same refund. For a full refund a cap hides this. For a partial refund of half or more, the learner would lose access. Not checked beyond the reviewer's reading.      | Design            |
| Cancelling a class is N refunds in one request     | With one server and no job queue, a timeout leaves a class half refunded with no record of which seats are done.                                                                                                                                                           | Design            |
| The phone app loses the class choice               | Paid checkout in the app opens the website's course page. A class picked in the app is not carried over.                                                                                                                                                                   | UX                |
| Same price, different contents                     | The course card promises "lifetime access" and "self-paced". A class buyer gets only what the teacher shares, at the same price. The "You're in" page and the receipt say "start whenever you like".                                                                       | UX                |
| Two cards that look the same                       | My Learning shows title, teacher, date and progress. A learner with both packages sees two near-identical cards, and two certificates with the same course title.                                                                                                          | UX, Migration     |
| "Cancelled" collides with "refunded"               | A refunded enrollment today shows a red badge, cannot be opened, and the email says access is removed. A cancelled class with materials switched on is a new state. A new status value would show as raw text in older apps.                                               | UX, Migration     |
| The learner's side of a flagged check-in           | The concept says what the instructor sees. It does not say whether a flagged check-in counts as present, or what the learner is shown.                                                                                                                                     | UX                |
| Confirming a manual mark                           | A manual mark is mostly needed when the learner's phone is not working, and that learner is then asked to confirm on it. There is no in-app notice, so the request arrives by email. "Never confirms" is the normal case.                                                  | UX, Design        |
| Check-in and its fallback fail together            | Both need the learner's device to reach the one server during a short window.                                                                                                                                                                                              | Design            |

**What the reviewers propose**

- A class purchase is its own enrollment row with a reference to the class.
  Replace the one rule with two: one self-paced row per learner and course, and
  one row per learner and class.
- Existing learner endpoints keep meaning "self-paced". Class data goes on new
  fields and a new checkout route, so installed apps are not surprised.
- The unpaid class enrollment is the seat hold, with an expiry, taken under a
  lock on the class. Seats are counted from enrollment rows, so every refund
  path frees a seat with no extra code.
- The class goes into the payment page's stored details and into what makes two
  checkout attempts "the same".
- What a class purchase lets the learner open is checked wherever an enrollment
  is loaded.
- A flagged check-in counts as present at once, and the instructor's action is
  to overturn it.
- A manual mark counts at once. The learner gets a notice with one action,
  "this was not me", open for a fixed number of days.
- The refund rule is one function beside the fee calculation, and the amount
  and its reason are stored with the refund.
- A cancellation is a stored record with one line per seat, so it can be
  resumed.

### Checks made after the second review

The author asked two things: whether consumer rules require a full refund when
a class is cancelled, and how to stop the refund rule being abused at Elevate's
cost. These are checks against published sources, not reviewer findings.

**What Stripe's documentation says**

| Fact                                                                                                                                                                                | Effect on this concept                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Stripe does not return its processing fee when a payment is refunded.                                                                                                               | Every full refund costs someone the fee: S$17.50 on a S$500 seat.                                                            |
| With payouts paused on a teacher's account, the money must be paid out within 90 days. The table names Thailand and the United States; Singapore falls under "all other countries". | A class cannot be sold more than about 90 days before its money is released.                                                 |
| An automatic payout delay can be set to at most 31 days.                                                                                                                            | A fixed delay is too short for classes sold weeks ahead. Pausing payouts and releasing them by a job is the workable route.  |
| Pausing payouts is a setting on the whole account.                                                                                                                                  | The same job must keep paying out a teacher's self-paced earnings while it holds their class money.                          |
| Elevate cannot debit a teacher's Stripe balance directly. That feature is not offered in Singapore.                                                                                 | A fee owed by a teacher has to be kept back from money moving in the same refund, not collected afterwards.                  |
| On a refund, Elevate's balance is debited unless the transfer to the teacher is reversed.                                                                                           | With the money still in the teacher's account, the reversal has something to draw on. This is what holding the payment buys. |

**What the consumer sources say**

- No source found states a rule that a consumer must get a full refund when a
  supplier cancels a prepaid service.
- The text of the Consumer Protection (Fair Trading) Act could not be read; the
  government statute site refused the request. The competition regulator's
  summary lists, as an unfair practice, "accepting payment from consumers
  despite knowing it is unable to supply", and says the list is not complete.
- A standard term that limits a business's liability for its own breach must be
  reasonable under the Unfair Contract Terms Act. No source says whether keeping
  a card fee after cancelling one's own class passes that test.
- Three SkillsFuture training providers publish their terms for a class they
  cancel. Two promise a full refund with no deduction. One refunds the net fee
  it received.
- A consumer can take a claim of up to S$20,000 to the Small Claims Tribunals.

The honest reading: nothing found requires a full refund, and nothing found
permits the deduction. The deduction is a term limiting liability for the
provider's own cancellation, it departs from what other providers promise, and
a lawyer should confirm it before it is shown to a learner.

**Decision: the party that cancels bears Stripe's fee**

Proposed in answer to the author's question and accepted by the author.

| Who ends the seat                   | Learner gets                                           | Who bears Stripe's fee                                                                                                    |
| ----------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| The teacher cancels the class       | Full refund                                            | The teacher. Elevate keeps the fee amount back when it returns its commission to the teacher's account during the refund. |
| The learner withdraws               | Amount paid less Stripe's fee, up to a stated deadline | The learner. This is the author's rule, applied where the learner chose to leave.                                         |
| Elevate cancels, or Elevate's fault | Full refund                                            | Elevate.                                                                                                                  |

Elevate loses nothing in the first two rows, and the learner who did nothing
wrong is refunded in full. The first row relies on refunding only part of
Elevate's fee to the teacher's account; this needs a test in a Stripe sandbox.

**Proposed controls against abuse**

Proposed in answer to the author's question. The author has accepted the fee
rule above; these controls have not been accepted one by one.

| Abuse                                                          | Control                                                                                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A teacher sells a class, is paid, and cancels or never runs it | Payment is held. Release needs the class to have ended and at least one time block with recorded check-ins; a class with no attendance goes to Support before any release. |
| Stolen cards used to buy seats so the money can be paid out    | Release some days after the class ends, not on the day. Nobody on a teaching profile can buy a seat in that profile's class.                                               |
| A teacher cancels often                                        | The teacher bears the fee per seat. A cancellation close to the start date, or a second one in a set period, needs Support.                                                |
| Accounts take seats to block a class                           | One seat hold per learner per course, released when they leave checkout. A learner who withdraws bears the fee.                                                            |
| A learner attends and then disputes the charge with their bank | The attendance record is the evidence. Elevate has no handler for disputes today; one is needed before class money is released automatically.                              |
| Zero-price promo codes used to place people in a class         | Refused on classes.                                                                                                                                                        |
| One large cancelled class                                      | For the beta, a ceiling on price times seats per profile.                                                                                                                  |

### What already exists and can be reused

| Piece                         | Where                                                    | Use                                                                                                |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Audit log                     | `apps/api/src/services/audit.service.ts` (`recordAudit`) | Low-volume events: schedule published, class changed, bypass, manual mark. Not for every check-in. |
| Error codes                   | `packages/core/src/contracts/errors.ts`                  | One code and one learner sentence per refusal reason, in English and Chinese.                      |
| Request ID                    | `apps/api/src/middleware/request-id.ts`                  | A reference a learner can read out to the instructor. No app shows it yet.                         |
| Server clock                  | `deps.now()`                                             | Check-in decisions on server time, testable.                                                       |
| Duplicate-payment refund path | `payments.service.ts`                                    | The last resort for a payment that lands after its seat was lost.                                  |
| Client polling                | `apps/learner/src/app/checkout/success.tsx`              | The pattern for the day view; no push channel is needed.                                           |
| One-off task runner           | `infra/README.md` (seed and preview tasks)               | A later home for timed reminders, if a loop inside the API is not wanted.                          |

### Not verified

- The current wording of Singapore's privacy guidance on identity card copies.
- Stripe's minimum lifetime for a checkout session, believed to be 30 minutes.
- The field list of SSG's attendance interface, and whether its "session" matches
  a time block.
- Whether the native learner app is in the app stores or in testers' hands.
- How many real enrollments exist in production.
- The email provider's rate limit for a class-wide send.
- What Stripe does when a refund pulls money back from a teacher balance that
  is empty. The reviewer asks for a test in a Stripe sandbox.
- That Stripe's 90-day limit on held money applies to Singapore. The page lists
  it under "all other countries" and does not name Singapore.
- That Elevate can return only part of its fee to a teacher's account during a
  refund. The proposal that the cancelling teacher bears Stripe's fee rests on
  this.
- The text of the Consumer Protection (Fair Trading) Act, and whether a term
  that keeps a card fee after the provider cancels is enforceable. This needs a
  lawyer.
- Whether SSG requires a full refund when a provider cancels a funded course.
- Whether pausing payouts on teachers' accounts brings any licensing duty.
- How Stripe splits a partial refund between the teacher's share and Elevate's
  fee, and whether its refund notice lists each refund.
- Which Stripe payment methods are enabled, and so how late a payment can land.
- The Postgres version, which decides how the narrowed rule can be written.

## Goals vs. Non-Goals

- **In-Scope Goals** (as confirmed by the author):
  - A teaching profile schedules a single-day or multi-day class of a live
    course: dates, one instructor from the profile, N seats, a venue or remote.
  - A schedule is a draft until published. Support does not approve it.
  - A live class is a separate package from the self-paced course. A learner
    pays and picks a class in the same flow, and a full class cannot be picked.
    The self-paced course stays on sale as it is today, and buying it gives no
    place in a class.
  - A class is sold at the course's price, from the existing course page, and
    only through checkout. Nobody is placed in a class without a sale.
  - One learner may own the self-paced course and a class seat for the same
    course. They are two purchases with separate progress and separate
    certificates.
  - Payment for a class is held. The teacher is paid after the class, not at
    the moment of sale.
  - The party that ends a seat bears Stripe's processing fee. When the teacher
    cancels a class, the learner is refunded in full and the teacher bears the
    fee. When a learner withdraws, the refund is the amount paid less the fee.
    When Elevate cancels, the learner is refunded in full and Elevate bears it.
  - After a cancelled class, the teacher can switch on access to that class's
    materials for its learners.
  - A class purchase never opens the self-paced course.
  - Attendance is taken once per time block. The block is configurable and
    defaults to one per day. There is no minimum-attendance rule.
  - The learner checks in on their own device with a rotating QR code or
    6-character code that the instructor shows. For an in-person class the
    location reading is stored as evidence and does not block the check-in. A
    remote class takes no location reading.
  - The instructor follows check-ins in the day view. A check-in with a missing,
    refused or out-of-range location is flagged and counts as present at once.
    The instructor overturns a wrong one per learner with a reason. As a last
    resort, per learner, the instructor marks attendance by hand with a reason
    and a statement that an identity document was checked. The mark counts at
    once, and the learner has a fixed number of days to say "this was not me".
    No identity image or learner photo is stored.
  - The attendance record is Elevate's own, can be audited, and is shaped so it
    can later be matched with or sent to SSG.
  - After check-in the learner lands on a class page with their progress and the
    class materials. A class learner can open only what the teacher has shared:
    lessons of the course, or files added for the class.
  - Enrolled learners are told when a published class changes.

- **Out-of-Scope Non-Goals:**
  - Any connection to SSG or Singpass in 1.0.0.
  - Grant money in the payment flow in 1.0.0. The held-payment design must leave
    room for it; the author wants that flow discussed before it is fixed.
  - Registering Elevate or a profile as an SSG training provider.
  - A minimum-attendance rule, or any automatic refund or payout decision based
    on attendance.
  - Class and attendance reminders in the first cut. Email reminders come later,
    push after that.
  - Support approval of schedules.
  - Hosting the video call for a remote class.

## Alternatives Weighed

**Rejected by the author during ideation**

- **Support approves schedules, as it approves courses.** Rejected by author:
  Support does not need to be involved in scheduling.
- **Prerequisites decide what a class learner can open, alone or together with
  teacher sharing.** Rejected by author: for a class learner, only what the
  teacher has shared decides.
- **The learner buys the course first and is placed in a class afterwards.**
  Rejected by author: paying and picking a class happen in one flow.
- **A single waiver that turns off the location check.** Rejected by author: the
  fallback is tiered. Self check-in first, then a per-learner location bypass
  with a form, then a per-learner manual mark with evidence. The last two need a
  reason each time.
- **A minimum-attendance threshold.** Rejected by author for now: no threshold
  currently.
- **Push notifications in the first cut.** Rejected by author for now: the
  feature comes first, reminders later, email before push.
- **Connecting to SSG in 1.0.0.** Set aside by author: the 1.0.0 record is
  Elevate's own. The author's longer-term intent is that Elevate is the
  registered provider for personal profiles and unregistered organisations, and
  registered organisations use Elevate as software for compliance.

**Rejected by the author after the review**

- **Storing a photo of the learner and an image of an identity document for a
  manual mark.** This was the author's first approach. Rejected by author after
  five lenses raised it: the current storage would keep the images under a
  public key and could not delete them reliably (Blocker 1).
- **Refusing a check-in until the instructor bypasses the location check.**
  This was the author's first approach. Rejected by author after four lenses
  raised it: indoor readings fail often and every failure would queue at the
  instructor (Blocker 6).
- **Dropping the location reading altogether.** Rejected by author: the reading
  is kept as evidence on the record.
- **Filling the first class lists from learners already enrolled in the
  self-paced course.** Proposed by three lenses to keep the payment code out of
  the first slice. Rejected by author: a live class is a different package from
  self-paced enrollment and the two are not mixed.
- **Offering self-paced access when a class is cancelled.** Proposed by the
  inventive lens. Rejected for the same reason: the packages are not mixed. A
  cancelled class gives a partial refund and, if the teacher allows it, access
  to that class's materials.
- **A teacher or Support placing playtest learners in a class without a sale.**
  Rejected by author: live classes are not given out for free, and the only way
  in is through checkout.
- **A price set per class.** Rejected by author: a class takes the course's
  price.
- **Listing a class as its own entry in the catalog.** Rejected by author:
  classes are sold from the existing course page.
- **One enrollment per learner per course, with the class seat as a row that
  points at it.** Recommended by three lenses. Not compatible with the author's
  decision that a learner may own both packages with separate progress and
  certificates, because those hang off the enrollment row. The class purchase
  becomes its own enrollment. The reviewers have not seen this.

**Rejected by the author after the second review**

- **Paying the teacher at the moment of a class sale, as self-paced sales do.**
  Rejected by author: a cancelled class would pull the money back from a teacher
  who may already have withdrawn it, and Elevate carries the shortfall.
- **Holding class money in Elevate's own Stripe balance.** Rejected by author:
  the money waits in the teacher's own account with payouts paused, so the
  current payment model stays.
- **A fixed payout delay on the teacher's account.** Not workable: Stripe allows
  at most 31 days. Payouts are paused and released by a job.
- **A person pressing a button to release each class's money.** Rejected by
  author: new infrastructure does it.
- **Accepting a capped exposure for the beta with no hold.** Not chosen by
  author: the payment is held.
- **A refund split in proportion between the teacher's share and Elevate's fee,
  with Elevate absorbing Stripe's fee.** Rejected by author: Elevate would lose
  money above about 80% refunded.
- **Refunding every cancelled class at the amount paid less Stripe's fee,
  whoever cancelled.** This was the author's rule after the second review.
  Replaced by author after the consumer-rules check: no source permits the
  deduction when the provider cancels, other providers refund in full, and a
  learner who did nothing wrong would bear the cost. The party that cancels
  bears the fee.
- **The instructor clears each location flag before the check-in counts.** This
  was the author's earlier version. Rejected by author: a flagged check-in
  counts at once, so a learner is never shown "checked in" and later left
  uncleared.
- **The learner must confirm a manual mark before it counts.** This was the
  author's earlier version. Rejected by author: the learner who needs a manual
  mark is usually the one whose phone is not working. The mark counts at once
  and can be disputed.

**Rejected on technical grounds by the reviewers**

- **Storing attendance in the existing `attendance_records` list.** It is
  rewritten in place and cannot be audited (Blocker 2).
- **Putting identity images through the existing media upload.** They would be
  stored under a public key (Blocker 1).
- **Keeping the current code in server memory, or storing a row per rotation.**
  The first breaks on deploy; the second adds a write every few seconds per
  class for no gain.
- **Server push for the day view.** The single API task would drop connections
  on every deploy. Polling every few seconds costs under one request per second
  per open class.
- **A fourth "instructor" role.** It touches invitations, the membership list,
  the route table and both portals. An instructor is an assignment on the class
  plus named capabilities in the existing role table.
- **Copying the course's draft-rows pattern for schedules.** A class needs one
  status column with a small written set of states.
- **Putting the class on the existing enrollment as a mode flag.** A learner
  could then never hold both packages, and a refunded row is reused on the next
  checkout, which would overwrite the class choice.
- **Dropping the one-enrollment-per-course rule outright.** It is the only thing
  that stops two self-paced purchases of one course from two browser tabs. The
  rule is narrowed, not removed.
- **A separate seat table that owns progress and certificates.** Progress, quiz
  attempts, certificates and payments all point at the enrollment. A second
  owner means changing the payment path and copying three tables.
- **A new enrollment status for a cancelled class.** Older installed apps would
  show it as raw text. The cancelled state is kept on the class.

## Key Decisions & Staging for Next Steps

### Decided

| Decision                                                                                                                                                                              | Source                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| A class is a fixed time, one instructor, up to N learners, at a venue or remote.                                                                                                      | Author                         |
| The instructor can be any member of the teaching profile.                                                                                                                             | Author                         |
| Schedules are draft then published, with no Support approval.                                                                                                                         | Author                         |
| A live class is a separate package from the self-paced course. The two are not mixed.                                                                                                 | Author, after review           |
| The learner pays and picks a class in one flow. A full class cannot be picked.                                                                                                        | Author                         |
| A class costs the course's price and is sold from the existing course page, only through checkout.                                                                                    | Author, after review           |
| A learner may own the self-paced course and a class seat for the same course, with separate progress and separate certificates.                                                       | Author, after review           |
| The party that ends a seat bears Stripe's fee: the teacher when the teacher cancels (learner refunded in full), the learner when the learner withdraws, Elevate when Elevate cancels. | Author, after the refund check |
| After a cancelled class, the teacher can switch on access to that class's materials.                                                                                                  | Author, after review           |
| Class payments are held. The teacher is paid after the class, not at sale.                                                                                                            | Author, after second review    |
| Held money waits in the teacher's own Stripe account with payouts paused. New infrastructure releases it.                                                                             | Author, after second review    |
| A class purchase never opens the self-paced course.                                                                                                                                   | Author, after second review    |
| A flagged check-in counts as present at once; the instructor overturns a wrong one with a reason.                                                                                     | Author, after second review    |
| A manual mark counts at once; the learner has a fixed number of days to dispute it.                                                                                                   | Author, after second review    |
| Attendance is built first, once per time block, default one per day, no threshold.                                                                                                    | Author                         |
| Proof is a rotating QR or 6-character code. Location is stored as evidence for in-person classes and does not block a check-in. Remote classes take no reading.                       | Author, after review           |
| Fallbacks are per learner: the instructor overturns a flagged check-in with a reason, or marks attendance by hand with a reason and an "identity checked" statement.                  | Author, after review           |
| No identity image or learner photo is stored.                                                                                                                                         | Author, after review           |
| A class learner can open only what the teacher has shared. Teachers can add files for a class.                                                                                        | Author                         |
| Learners are told of class changes by app and email.                                                                                                                                  | Author                         |
| No SSG connection in 1.0.0. Reminders later, email before push.                                                                                                                       | Author                         |

### Open decisions that block the schema

These must be settled before `/egm-draft`, in this order.

1. **How held class payments work.** Decided: the money waits in the teacher's
   own Stripe account with payouts paused, the current payment model stays, and
   new infrastructure releases the money. Still to decide:
   - when class money is released: after the last time block, or a set number
     of days later to leave room for disputes;
   - how far ahead a class may be sold, given Stripe's 90-day limit on held
     money;
   - what the flow must leave room for when grant money is added: who the
     learner pays, how much, and where the grant amount arrives. The author
     wants this discussed;
   - who may cancel a class, the teacher or only Support.
     Pausing payouts applies to the whole account, so the new job also pays out
     self-paced earnings. This changes the payment decision record (ADR 003) and
     needs its own decision record.
2. **The refund rule.** Decided: the party that cancels bears Stripe's fee.
   Still to decide:
   - a test in a Stripe sandbox that Elevate can keep the fee amount back from
     the teacher during a refund. If it cannot, the teacher row of the rule
     needs another mechanism;
   - the deadline after which a learner can no longer withdraw for a refund;
   - which of the proposed abuse controls the author takes;
   - what is refunded when a class is cancelled after some of its days have
     run;
   - a lawyer's confirmation of the refund terms before they are shown, in both
     languages, to a learner before payment.
3. **What "class materials" are.** Decided: a class purchase never opens the
   self-paced course. Still to decide: what access to a cancelled class's
   materials covers, and for how long. The working reading is "whatever the
   teacher had shared with that class".
4. **Two enrollments for one course (R3, R5).** The shape is proposed by the
   reviewers. Still for the author:
   - whether a learner may hold seats in two classes of the same course at once.
     Rebooking after a cancelled class needs two class rows over time in any
     case;
   - whether a learner may move to another class;
   - whether a promo code that makes the price zero is refused on a class;
   - whether class seats count in the course's enrol counter and the "popular"
     sort.
5. **Check-in in a browser.** Is the web version a full check-in path? If yes,
   the QR code is a web link and no native module is needed for the beta.
6. **Completion for a class learner.** Does progress count all lessons or only
   shared ones? What earns the class certificate: attendance, materials or
   both? What can be opened once the class ends?
7. **Time zone and time blocks.** One named time zone per class, and blocks
   stored as rows when the class is published, is the reviewers' proposal.
8. **Who may do what.** Which roles can publish a schedule, take attendance,
   overturn a flagged check-in and mark by hand. Whether day-view actions are
   limited to the assigned instructor. Whether Support staff may mark
   attendance.
9. **What "told by app" means in 1.0.0.** A notice shown when the app is next
   opened, or email only.
10. **Disputed manual marks.** Decided: a manual mark counts at once and the
    learner can say "this was not me". Still to decide: how many days the
    learner has, and who reviews a dispute.

### Proposed order of delivery

Proposed by the reviewers and adjusted for the author's decisions. Not yet
accepted by the author.

1. **Foundations, as the first production release.** New tables: class, time
   blocks, attendance events. A class reference on the enrollment, the narrowed
   one-enrollment rule, and lookups that know about classes. A switch that keeps
   class selling off. Existing learner endpoints keep meaning "self-paced".
   Nothing after this step may be deployed over a version older than it.
2. **Teach: create and publish a class.** A class must be published before it
   can be sold.
3. **The class package at checkout, with seat holds.** The author has decided
   that checkout is the only way into a class, so this now comes before the
   first check-in. It is the part four lenses called the riskiest. It needs
   open decisions 1, 3 and 4 settled, and it is switched on as a second
   release.
4. **Check-in and the day view.** Typed rotating code and QR web link, location
   recorded, every attempt stored with a reason. The day view polls and shows
   when it was last updated. A separate window shows only the code, safe to
   project.
5. **Fallbacks.** Per-learner flag clearing with a reason, then manual mark with
   learner confirmation. A view for Support of one class day.
6. **Class page and shared materials**, after open decision 6.
7. **Change notices, and cancelling a class with a partial refund**, after open
   decisions 1 and 2. Until this step exists, a class cannot be cancelled
   through the product.
8. **Later:** moving class, reminders, push, SSG.

The author asked for attendance to be built first. With checkout as the only
way into a class, attendance cannot be tried with real learners until step 3 is
done. Steps 1 and 4 can still be built and tested first with test data.

### Before design starts

- Record a dated product decision in `docs/spec.md` that moves class scheduling
  and attendance into scope, and correct lines 33 and 63.
- Write decision records for the attendance record and for any change to when
  teachers are paid.
- Lengthen database backup retention before real attendance is recorded.
  Production keeps 7 days today.

### Pass or fail checks for the playtest

Proposed, for the author to accept or change:

- A class of 20 checks in within five minutes with the instructor filling in no
  form.
- A learner whose location is refused or wrong is not left without an
  instruction on their screen.
- Every attendance change shows who made it, when, by which method and why, and
  no earlier row has been altered.
- A deploy during a running class does not invalidate the code on the screen.
- The share of check-ins by tier (self, bypass, manual) is visible per class.
