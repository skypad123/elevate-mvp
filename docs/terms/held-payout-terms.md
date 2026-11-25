# Held-Payout Terms

- **Status:** Draft, revised on 2026-11-25 for the author's best-guess
  answers. Not read by a lawyer. Not signed off by the author. Not in force.
- **Version:** `2026-12`, carried in the code as `CLASS_SALES_TERMS_VERSION`.
- **Who sees it:** the owner of a teaching profile, on the class-sales card
  in Teach Settings, above "Accept and start selling classes". Accepting is
  what the design calls opting in.
- **Where the shown text lives:** the `teachSettings` area of `packages/i18n`,
  once the build reaches it. Nothing is built yet.
- **Rules it states:** those of
  [Scheduled Classes, Part 2](../designs/scheduled-classes-selling.md). The
  table under "What each term rests on" names the decision or best guess
  behind each one. The best guesses are in
  [best_guess_answers.md](../designs/reviews/scheduled-classes-selling/best_guess_answers.md).
- **Chinese text:** not drafted. It follows once the English wording is
  settled.

## The terms

"You" is the teaching profile. A "session" is one dated meeting of a class;
the design calls it a block. "Your share" of a sale is the price the learner
paid less Elevate's fee.

### What accepting does

1. Only the owner of the profile can accept these terms. Once they are
   accepted, the profile can sell seats in its classes.
2. From then on, Elevate decides when money in your Stripe account is paid to
   your bank. This covers every sale you make through Elevate, self-paced
   courses included. Stripe no longer pays you automatically.
3. You cannot change your payout schedule or pay yourself out from your
   Stripe dashboard.

### Leaving

4. The owner can stop selling classes at any time, in Teach Settings. From
   that moment none of your classes is on sale. Seats already sold are not
   affected: those classes run, and their money is held and paid as these
   terms say.
5. Thirty days after you stop, or later if money from a class is still held
   then, Elevate pays you what is due and hands your payouts back to Stripe's
   own schedule. We email you when that is done. You can accept these terms
   again later.

### When you are paid

6. Elevate pays you at most once a day, after 10:00 Singapore time, when at
   least S$1 can be paid.
7. A payout is made of whole sales, oldest first. A sale that does not fit in
   one day's payout waits for the next day, and so do the sales after it.
8. Money from a self-paced sale can be paid as soon as Stripe makes it
   available in your balance.
9. Money that was in your Stripe balance when you accepted is paid to you in
   the same daily payouts.

### When class money is held

10. Your share of a class seat is held in your Stripe account until 7 days
    after the last session of the class ends. If the class is cancelled, it
    is held until 7 days after the cancellation.
11. The money for a class is not released while a learner can still dispute
    a mark that says they were present. A learner has 7 days to dispute a
    mark made by hand.
12. If no learner has attended a class, Elevate looks at the class before its
    money is released.
13. The money for one seat stays held while a refund for that seat is in
    progress, or while the learner's bank is deciding a dispute about the
    payment.
14. No sale's money is held for more than 85 days from the payment. For that
    reason a class can be sold only if it ends within 75 days.

### Elevate's fee

15. Elevate's fee on each sale has two parts:
    - a commission, which is your profile's commission rate (15% unless
      Elevate has agreed another rate with you) of the price less the
      estimate below;
    - an estimate of Stripe's processing fee: 3.4% of the price plus S$0.50.

    The estimate is the same however the learner pays. Stripe's real fee can
    be lower, as on a payment by PayNow (1.3%), or higher, as on a card issued
    outside Singapore (3.9% plus S$0.50). Elevate keeps the difference when
    the real fee is lower and bears it when it is higher. Your share of a
    sale does not change. On a seat of S$500, Elevate's fee is S$89.88 and
    your share is S$410.12.

### Refunds, and who bears Stripe's fee

Stripe keeps its processing fee when a payment is refunded.

16. **A learner withdraws.** A learner who has not attended can withdraw
    until 7 days before the first session. They are refunded the price less
    Stripe's fee. Your share of that sale is taken back, and it costs you
    nothing more.
17. **You change a session's date or time after a seat is sold.** Every
    learner with a seat is emailed. A learner who has not attended can then
    withdraw until the class starts and is refunded in full. You bear
    Stripe's fee on each seat refunded this way.
18. **You move a learner to another class.** The owner or a manager can move
    a learner who has not attended to another class of the same course. The
    learner is emailed and has the same right to withdraw as in term 17.
19. **You cancel a class.** Every learner who has not attended is refunded in
    full. Your share of each of those sales is taken back, and you bear
    Stripe's fee on each.
20. A learner who has attended a session of a class you cancel is refunded
    the part of the price for the sessions that had not started. The same
    part of your share is taken back, and Elevate returns to you the same
    part of what it kept of its fee. Stripe's fee falls on you and Elevate in
    the same proportion.
21. You cannot cancel a class after its money has been released. Write to
    Elevate.
22. **You give a refund.** The owner or a manager can refund a learner any
    part of what they paid, until the money for the seat is released. The
    learner keeps the seat. Elevate returns to you the same proportion of
    what it kept of its fee.
23. **A learner pays but gets no seat**, because the class filled or started
    while they were paying. They are refunded in full at Elevate's cost.

### When Elevate cancels a class

24. Elevate may cancel one of your classes only when:
    - the teacher did not turn up, or cannot teach the class;
    - the venue is unsafe or cannot be used;
    - you have broken Elevate's rules or acted dishonestly;
    - your profile is suspended; or
    - the law requires it.
25. When there is time, Elevate tells you before it cancels and gives you a
    chance to answer. It always tells you the reason.
26. When Elevate cancels a class, every learner is refunded in full, whether
    or not they attended. Your share of each of those sales is taken back.
    Elevate bears Stripe's fee. Elevate never takes back more than it
    refunds.

### What "attended" means

27. A learner has attended a session when they checked in to it themselves.
28. A learner has also attended a session when your instructor marked them
    present by hand, Elevate emailed the learner to say so, and the learner
    did not dispute the mark within 7 days.

### Disputes at a learner's bank

29. If a learner asks their bank to reverse a card payment and the bank
    decides for the learner, your whole share of that sale is taken back.
    Elevate bears Stripe's fee and the bank's dispute fee.
30. If the bank decides for Elevate, nothing changes for you.

### Money you owe

31. A refund or a bank's decision can take back money you were already paid,
    or more than your Stripe balance holds. That amount is a debt. It is
    taken from your next payouts before anything else is paid.
32. If your payouts have not covered a debt, Elevate can ask you to pay what
    remains. It sends you a statement that lists each amount. You can
    question any amount on it.

## What each term rests on

| Term   | Rule in the design                                                                                                          | Decision or best guess      |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1      | Only the owner opts in, after a recent sign-in.                                                                             | Before the review; drafting |
| 2      | The profile's Stripe account is switched to manual payouts, and the release job pays every sale.                            | 1                           |
| 3      | "Edit payout schedule" and "Manual payouts" are turned off for the Express dashboard, for every account.                    | 1; G2                       |
| 4, 5   | Notice to leave takes the profile's classes off sale; the account returns to automatic payouts once nothing is held.        | G16                         |
| 6, 7   | One payout a day, in the first run at or after 10:00 Singapore time, none under S$1, whole payments, oldest first.          | Drafting; R1                |
| 8      | Self-paced payouts are not held. A payout never exceeds the available balance.                                              | Before the review           |
| 9      | The balance read at opt-in is recorded as two opening amounts.                                                              | Drafting                    |
| 10     | One release per class, 7 days after its last block ends, or after cancellation.                                             | Before the review           |
| 11     | The release waits while any manual mark in the class is open.                                                               | R5                          |
| 12     | A class with no learner counted as attended is reviewed by Support before release.                                          | 2b                          |
| 13     | A payment with an unfinished refund or an open bank dispute is not released.                                                | 5; drafting                 |
| 14     | A payment is released at 85 days. A seat is sold only for a class ending within 75 days.                                    | Drafting; G1                |
| 15     | The fee arithmetic in `money.ts`, with the profile's commission rate. One estimate for every method.                        | R7; G7; G19                 |
| 16     | `learner_withdrew`: the profile's net on the seat is zero.                                                                  | R2                          |
| 17, 18 | `changed_withdrew`: the profile's net on the seat is Stripe's fee, lost. A move gives the same right.                       | R3                          |
| 19     | `teacher_cancelled`: a learner not counted as attended is refunded in full. The profile bears Stripe's fee.                 | 3; R2                       |
| 20     | `teacher_cancelled_part`: the share for the blocks not taught, with Elevate's fee returned in proportion.                   | G12                         |
| 21     | The profile cannot cancel a class that is released.                                                                         | Drafting                    |
| 22     | A discretionary refund by the owner or a manager, until release. Elevate's fee is returned in proportion.                   | Before the review           |
| 23     | `seat_lost`: refunded in full, at Elevate's cost.                                                                           | Drafting                    |
| 24, 25 | Cancellation by Elevate takes one of five grounds and a note; the owner is emailed; Support warns first when it can.        | G17                         |
| 26     | `elevate_cancelled`: every seat in full, at Elevate's cost.                                                                 | R4; G13                     |
| 27, 28 | Counted as attended: the learner's own check-in, or a manual mark not disputed in 7 days.                                   | 3                           |
| 29, 30 | A lost bank dispute undoes the sale. Elevate bears Stripe's fee and S$15. A won one changes nothing.                        | Before the review; G5       |
| 31, 32 | A refund or a lost bank dispute after a payout is an adjustment; a debt is chosen first, and what remains can be asked for. | R1; G18                     |

## Open before these terms can be in force

- **A lawyer has not read them.** The author decided to sell before the
  licensing question is answered (G9). These terms describe the arrangement
  that question is about, so they should be among the first things a lawyer
  reads.
- **Term 3 reaches teachers who have not accepted.** Every teacher is to be
  emailed 30 days before the two dashboard features are turned off in live
  mode (G15). That email is not drafted.
- **Term 14's numbers are provisional.** They depend on how Stripe counts the
  90 days it allows (G1).
- **Term 15 is the only written statement of Elevate's fee.** The teacher
  agreement accepted at application says nothing about fees. Teachers who
  sell only self-paced courses have no written fee terms.
- **Terms 24 and 25 are a closed list** (G17). A case outside it, such as a
  teacher who stops answering, cannot be cancelled by Elevate.
- **The Chinese text** is to be drafted, and signed off by the author.
