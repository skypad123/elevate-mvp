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
} as const
