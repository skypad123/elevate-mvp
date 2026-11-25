/** Checkout and its success page. */
export const learnerCheckoutEn = {
  // The page title, and the eyebrow of the phone app's "pay on the web" card
  'learnerCheckout.title': 'Checkout',
  'learnerCheckout.back': 'Back',
  'learnerCheckout.backToCourse': 'Back to course',
  // The quote could not be loaded; the error's own sentence shows under it
  'learnerCheckout.loadError.title': 'Could not start checkout',

  // Phone app only: a paid course is bought on the web site
  'learnerCheckout.web.title': 'Payments happen on the web',
  'learnerCheckout.web.body':
    'To keep prices low we take card payments on elevate.sg rather than through the app store. Your enrolment appears here as soon as you have paid.',
  'learnerCheckout.web.continue': 'Continue on the web',

  // Under the course title. {teacher} is the teacher's or company's name.
  'learnerCheckout.byTeacher': 'by {teacher}',

  'learnerCheckout.promo.label': 'Promo code',
  // An example code in the empty field; keep WELCOME10 as it is
  'learnerCheckout.promo.placeholder': 'e.g. WELCOME10',
  'learnerCheckout.promo.apply': 'Apply',
  // The button once a code is applied, to apply a changed code
  'learnerCheckout.promo.update': 'Update',
  // {code} is the promo code as typed; {percent} a whole number: "WELCOME10 applied: 10% off"
  'learnerCheckout.promo.appliedPercent': '{code} applied: {percent}% off',
  // {code} is the promo code; {amount} is like "S$5.00"
  'learnerCheckout.promo.appliedAmount': '{code} applied: {amount} off',

  'learnerCheckout.row.price': 'Course price',
  'learnerCheckout.row.discount': 'Discount',
  'learnerCheckout.row.total': 'Total today',
  'learnerCheckout.fees': 'Includes all payment processing fees. No subscription.',
  'learnerCheckout.pay.free': 'Enrol for free',
  // {price} is like "S$120.00"
  'learnerCheckout.pay.stripe': 'Pay {price} with Stripe',
  'learnerCheckout.belowMinimum':
    'The discounted price is below the minimum card payment. Remove the code to continue.',
  'learnerCheckout.stripeNote':
    "You will be taken to Stripe's secure checkout and back here when done.",

  // The success page, where Stripe sends the learner back after paying
  'learnerCheckout.success.checking': 'Confirming your payment…',
  'learnerCheckout.success.eyebrow': 'Enrolled',
  'learnerCheckout.success.title': "You're in.",
  'learnerCheckout.success.body':
    'A confirmation email is on its way. Your progress is saved as you go, on any device.',
  'learnerCheckout.success.start': 'Start learning',
  'learnerCheckout.success.backToCourse': 'Back to course page',
  'learnerCheckout.expired.title': 'That checkout expired',
  'learnerCheckout.expired.body': 'No payment was taken. Start again from the course page.',
  'learnerCheckout.expired.explore': 'Explore courses',
  'learnerCheckout.failed.title': 'We could not confirm the payment',
  // The page was opened without Stripe's ?session_id=
  'learnerCheckout.failed.noSession': 'This page needs a checkout session.',
  // Shown after about 30 seconds of waiting. "My Learning" is the name of the app's tab.
  'learnerCheckout.failed.slow':
    'Payment confirmation is taking longer than usual. Your enrolment will appear in My Learning once Stripe confirms it.',
  'learnerCheckout.failed.myLearning': 'Go to My Learning',

  // ── A seat in a class (checkout/class/[classId]) ──────────────────────────
  'learnerCheckout.class.title': 'Book a seat',
  // The summary card. {course} is the course title, {name} the instructor's name.
  'learnerCheckout.class.course': 'A class of {course}',
  'learnerCheckout.class.instructor': 'Taught by {name}',
  // The heading of the session list; each session follows on its own line with its time zone
  'learnerCheckout.class.sessions': 'Sessions',
  // {address} is the venue address the teacher typed
  'learnerCheckout.class.venue': 'Venue: {address}',
  'learnerCheckout.class.remote': 'Remote class',
  // {count} is the number of seats still free
  'learnerCheckout.class.seatsLeft.one': '{count} seat left',
  'learnerCheckout.class.seatsLeft.other': '{count} seats left',
  'learnerCheckout.class.full': 'This class is full, so it cannot be booked.',
  'learnerCheckout.class.row.price': 'Seat price',
  // Next to the pay button
  'learnerCheckout.class.agree': 'By paying, you accept the refund terms above.',
  'learnerCheckout.class.seatHeld':
    'Your seat is kept for 35 minutes from when you press Pay, while you pay on Stripe.',
  // Shown when the page reloaded the refund terms after the API said they had changed
  'learnerCheckout.class.termsReloaded':
    'The refund terms have changed. Read them again below, then press Pay.',
  'learnerCheckout.class.viewSeat': 'View your class',
  // Phone app only: a seat is bought on the web site
  'learnerCheckout.class.web.body':
    'To keep prices low we take payments on elevate.sg rather than through the app store. Your seat appears in My Learning as soon as you have paid.',

  // The refund terms (docs/terms/class-refund-terms.md, version 2026-12), shown above the pay
  // button. Each term is a whole sentence. A "session" is one dated meeting of the class.
  'learnerCheckout.terms.title': 'Refund terms',
  // {version} is like "2026-12"
  'learnerCheckout.terms.version': 'Version {version}',
  // {date} is the day and time withdrawal closes for this class, 7 days before its first session
  'learnerCheckout.terms.forThisClass':
    'For this class, you can withdraw for a refund until {date}.',
  'learnerCheckout.terms.buying.title': 'What you are buying',
  'learnerCheckout.terms.buying.1':
    'You are buying one seat in the class named on this page, on the dates shown, from Elevate. The class is taught by the teacher named on this page.',
  'learnerCheckout.terms.changeMind.title': 'If you change your mind',
  'learnerCheckout.terms.changeMind.2':
    'You can withdraw from the class until 7 days before its first session starts, as long as you have not attended a session.',
  'learnerCheckout.terms.changeMind.3':
    'If you withdraw in time, we refund the price you paid less the payment processing fee that our payment provider, Stripe, charged on your payment. Stripe keeps that fee when a payment is refunded. The fee depends on how you paid; the rates are under "The payment processing fee" below.',
  'learnerCheckout.terms.changeMind.4': 'After that date you cannot withdraw for a refund.',
  'learnerCheckout.terms.changes.title': 'If the class changes',
  'learnerCheckout.terms.changes.5':
    'If the teacher changes the date or time of a session after you have paid, we email you. You can then withdraw at any time before the class starts, and we refund the price you paid in full, as long as you have not attended a session.',
  'learnerCheckout.terms.cancelled.title': 'If the class is cancelled',
  'learnerCheckout.terms.cancelled.6':
    'If the teacher cancels the class and you have not attended a session, we refund the price you paid in full.',
  'learnerCheckout.terms.cancelled.7':
    'If the teacher cancels the class after you have attended a session, we refund the part of the price for the sessions that had not started when the class was cancelled. For example, if one session of five had taken place, we refund four fifths of the price.',
  'learnerCheckout.terms.cancelled.8':
    'If Elevate cancels the class, we refund the price you paid in full, whether or not you have attended.',
  'learnerCheckout.terms.attended.title': 'What "attended" means',
  'learnerCheckout.terms.attended.9':
    'You have attended a session when you checked in to it yourself.',
  'learnerCheckout.terms.attended.10':
    'You have also attended a session when the instructor marked you present by hand, we emailed you to say so, and you did not dispute the mark within 7 days of that email. If you dispute the mark in time, it does not count. During those 7 days you cannot withdraw unless you dispute the mark first.',
  'learnerCheckout.terms.seatTaken.title': 'If your seat is taken while you pay',
  'learnerCheckout.terms.seatTaken.11':
    'A seat is kept for you for 35 minutes while you pay. If your payment arrives after that and the class is full or has started, you do not get the seat, and we refund the price you paid in full.',
  'learnerCheckout.terms.paid.title': 'How a refund is paid',
  'learnerCheckout.terms.paid.12':
    'We send a refund within one working day of it becoming due. It goes back to the payment method you paid with, and we email you when it has been sent. A refund to a card usually shows on your statement 5 to 10 business days later, depending on your bank. A refund by PayNow usually arrives within minutes.',
  'learnerCheckout.terms.fee.title': 'The payment processing fee',
  'learnerCheckout.terms.fee.13':
    "The fee in term 3 is the fee Stripe charged on your own payment. Stripe's published rates for payments in Singapore dollars are:",
  // The rates of term 13, one a line, each a whole sentence
  'learnerCheckout.terms.fee.cardSg':
    'For a card issued in Singapore, the fee is 3.4% of the price plus S$0.50.',
  'learnerCheckout.terms.fee.cardAbroad':
    'For a card issued outside Singapore, the fee is 3.9% of the price plus S$0.50.',
  'learnerCheckout.terms.fee.paynow': 'For PayNow, the fee is 1.3% of the price.',
  'learnerCheckout.terms.fee.gst': 'Goods and Services Tax is added where Stripe charges it.',
  'learnerCheckout.terms.fee.example':
    'On a seat of S$500, that is S$17.50 for a card issued in Singapore and about S$7 for PayNow. Your class page shows the amount for your payment.',

  // The success page for a seat. {address} is the venue the teacher typed.
  'learnerCheckout.classSuccess.eyebrow': 'Seat booked',
  'learnerCheckout.classSuccess.title': 'Your seat is booked',
  // {name} is the class's name, {course} the course title
  'learnerCheckout.classSuccess.body':
    'You have a seat in {name}, a class of {course}. A receipt with the dates and the refund terms is on its way by email.',
  'learnerCheckout.classSuccess.when': 'Sessions',
  'learnerCheckout.classSuccess.venue': 'Venue: {address}',
  'learnerCheckout.classSuccess.remote':
    'Remote class: your instructor will email you how to join.',
  'learnerCheckout.classSuccess.view': 'View your class',
  // The payment arrived after the seat was gone: the class had filled, started or been cancelled
  'learnerCheckout.seatLost.title': 'The seat was taken while you paid',
  'learnerCheckout.seatLost.body':
    'Your payment arrived after the seat was no longer available, so you do not have a seat in this class. We are returning the price you paid in full, and we email you when the refund has been sent.',
  'learnerCheckout.seatLost.back': 'Back to the course',
} as const
