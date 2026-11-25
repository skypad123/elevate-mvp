# Class Refund Terms

- **Status:** Draft, revised on 2026-11-25 for the author's best-guess
  answers. Not read by a lawyer. Not signed off by the author. Not in force.
- **Version:** `2026-12`, carried in the code as `REFUND_TERMS_VERSION`.
- **Who sees it:** a learner, above the pay button on the class checkout
  page. One sentence of it is in the receipt email.
- **Where the shown text lives:** the `learnerCheckout` and `email` areas of
  `packages/i18n`, once the build reaches them. Nothing is built yet.
- **Rules it states:** those of
  [Scheduled Classes, Part 2](../designs/scheduled-classes-selling.md). The
  table under "What each term rests on" names the decision or best guess
  behind each one. The best guesses are in
  [best_guess_answers.md](../designs/reviews/scheduled-classes-selling/best_guess_answers.md).
- **Chinese text:** not drafted. It follows once the English wording is
  settled.

## The terms

A "session" below is one dated meeting of a class. The design calls it a
block; the terms use the word the learner sees in the app.

### What you are buying

1. You are buying one seat in the class named on this page, on the dates
   shown, from Elevate. The class is taught by the teacher named on this
   page.

### If you change your mind

2. You can withdraw from the class until 7 days before its first session
   starts, as long as you have not attended a session.
3. If you withdraw in time, we refund the price you paid less the payment
   processing fee that our payment provider, Stripe, charged on your payment.
   Stripe keeps that fee when a payment is refunded. The fee depends on how
   you paid; the rates are under "The payment processing fee" below.
4. After that date you cannot withdraw for a refund.

### If the class changes

5. If the teacher changes the date or time of a session after you have paid,
   we email you. You can then withdraw at any time before the class starts,
   and we refund the price you paid in full, as long as you have not attended
   a session.

### If the class is cancelled

6. If the teacher cancels the class and you have not attended a session, we
   refund the price you paid in full.
7. If the teacher cancels the class after you have attended a session, we
   refund the part of the price for the sessions that had not started when
   the class was cancelled. For example, if one session of five had taken
   place, we refund four fifths of the price.
8. If Elevate cancels the class, we refund the price you paid in full,
   whether or not you have attended.

### What "attended" means

9. You have attended a session when you checked in to it yourself.
10. You have also attended a session when the instructor marked you present
    by hand, we emailed you to say so, and you did not dispute the mark
    within 7 days of that email. If you dispute the mark in time, it does not
    count. During those 7 days you cannot withdraw unless you dispute the
    mark first.

### If your seat is taken while you pay

11. A seat is kept for you for 35 minutes while you pay. If your payment
    arrives after that and the class is full or has started, you do not get
    the seat, and we refund the price you paid in full.

### How a refund is paid

12. We send a refund within one working day of it becoming due. It goes back
    to the payment method you paid with, and we email you when it has been
    sent. A refund to a card usually shows on your statement 5 to 10
    business days later, depending on your bank. A refund by PayNow usually
    arrives within minutes.

### The payment processing fee

13. The fee in term 3 is the fee Stripe charged on your own payment. Stripe's
    published rates for payments in Singapore dollars are:
    - a card issued in Singapore: 3.4% of the price plus S$0.50;
    - a card issued outside Singapore: 3.9% of the price plus S$0.50;
    - PayNow: 1.3% of the price;
    - Goods and Services Tax is added where Stripe charges it.

    On a seat of S$500, that is S$17.50 for a card issued in Singapore and
    about S$7 for PayNow. Your class page shows the amount for your payment.

## What each term rests on

| Term   | Rule in the design                                                                                                                            | Decision or best guess          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1      | Elevate sells the seat and is the business of record on the payment; the profile teaches the class.                                           | G10                             |
| 2 to 4 | Withdrawal closes 7 days before the first block, and is refused once counted as attended.                                                     | Before the review, and drafting |
| 3, 13  | A withdrawal refund is the price less the fee Stripe really charged. The rates are shown before paying.                                       | R2; G7; G11                     |
| 5      | A block's time can change after a sale; a learner not counted as attended can withdraw in full.                                               | R3                              |
| 6      | When the profile cancels, a learner not counted as attended is refunded in full.                                                              | 3                               |
| 7      | When the profile cancels, a learner counted as attended gets the share of the price for the blocks not taught.                                | G12                             |
| 8      | When Elevate cancels, every seat is refunded in full.                                                                                         | R4; G13                         |
| 9, 10  | Counted as attended: the learner's own check-in, or a manual mark not disputed in 7 days. A learner with an open manual mark cannot withdraw. | 3                               |
| 11     | A reservation lasts 35 minutes; a payment that gets no seat is refunded in full at Elevate's cost.                                            | Drafting                        |
| 12     | The release job sends every refund and emails the learner once Stripe reports it succeeded. The times are Stripe's.                           | 5; G8                           |

## Open before these terms can be in force

- **A lawyer has not read them.** Every term above that rests on a best
  guess (G7 to G13) is to be confirmed. The questions for the lawyer are in
  [author_decisions.md](../designs/reviews/scheduled-classes-selling/author_decisions.md).
- **Term 1 is the sentence a lawyer should write** (G10). It decides who the
  learner's contract is with.
- **Term 12 promises one working day.** The release job runs every 15
  minutes, so this holds unless Stripe refuses a refund. A refund that fails
  is paid another way, by Support (G6), and can take longer.
- **Term 13 gives Stripe's published rates.** GST was seen on the PayNow fee
  in the sandbox and not on the card fee. The first live payments will show
  where GST applies.
- **The Chinese text** is to be drafted, and signed off by the author.
