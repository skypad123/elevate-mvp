/**
 * The emails a learner gets: the sign-in code, the receipt, the certificate and the refunds. They
 * are sent in the account's language (the sign-in code in the language of the page that asked);
 * see ADR 010. Teacher and Support emails stay English. The English text is today's, word for
 * word, because tests match it.
 *
 * Subjects and text parts are plain text; the HTML part is escaped by the template, so no message
 * contains markup.
 */
export const emailEn = {
  // The last line of every email
  'email.footer.ignore': 'If you did not request this email you can ignore it.',
  // The button's line in the plain-text part: {label} is the button text, {url} its link
  'email.text.cta': '{label}: {url}',

  // The sign-in code email. {portal} is "Elevate", "Elevate Teach" or "Elevate Support";
  // {code} is the six-digit code shown as "123 456"; {minutes} is how long the link works.
  'email.signIn.subject': 'Your {portal} sign-in code: {code}',
  'email.signIn.title': 'Sign in to {portal}',
  'email.signIn.body':
    'Use the button below to sign in. The link works once and expires in {minutes} minutes.',
  'email.signIn.button': 'Sign in',
  'email.signIn.codeIntro': 'On your phone? Enter this code in the app instead:',
  // The plain-text part, which has the link on the next line
  'email.signIn.text.open': 'Open this link (valid for {minutes} minutes, single use):',
  'email.signIn.text.code': 'Or enter this code in the app: {code}',

  // The receipt, sent when a payment enrols the learner. {amount} is like "S$89.00";
  // {course} is the course title and {teacher} the teaching profile's name; {url} is Stripe's
  // receipt page.
  'email.receipt.title': "You're enrolled: {course}",
  'email.receipt.paid': 'Thanks for your purchase. You paid {amount} for "{course}" by {teacher}.',
  'email.receipt.stripeReceipt': 'Your Stripe receipt: {url}',
  'email.receipt.noReceipt': 'A receipt is available from your Stripe payment confirmation.',
  'email.receipt.start': 'Start whenever you like; your progress is saved as you go.',
  'email.receipt.button': 'Start learning',

  // The certificate. {name} is the name printed on it; {url} is its public verification page.
  'email.certificate.title': 'Your certificate: {course}',
  'email.certificate.congrats': 'Congratulations, {name}. You completed "{course}" by {teacher}.',
  'email.certificate.verify': 'Anyone can verify it at {url} — no sign-in needed.',
  'email.certificate.button': 'View certificate',

  // A refund made by Support or in the Stripe dashboard. {amount} is like "89.00 SGD";
  // {reason} is what Support typed, or email.refund.reasonStripe.
  'email.refund.title': 'Refund issued for {course}',
  'email.refund.refunded':
    'We have refunded {amount} to your original payment method. It can take 5–10 working days to appear.',
  'email.refund.reason': 'Reason: {reason}',
  // The reason given when the refund was made in the Stripe dashboard
  'email.refund.reasonStripe': 'Refunded in Stripe',
  'email.refund.accessRemoved': 'Access to the course has been removed.',

  // A second payment for a course the learner already had, refunded automatically
  'email.duplicate.title': 'Refund issued: you paid twice for {course}',
  'email.duplicate.refunded':
    'You paid twice for "{course}", so we have refunded your second payment of {amount} to your original payment method. It can take 5–10 working days to appear.',
  'email.duplicate.kept': 'Your enrolment and your progress are not affected.',
  // When the other payment was refunded too
  'email.duplicate.removed':
    'Your other payment for this course has been refunded too, so access to the course has been removed.',
  'email.duplicate.button': 'Go to the course',
} as const
