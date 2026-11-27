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

  // A class's times, one line per block. {date} is like "Tue, 1 Dec 2026"; {start} and {end}
  // are like "09:00", in the class's time zone.
  'email.class.block': '{date}, {start}–{end}',
  // One instant in the class's time zone. {day} is like "Tue, 1 Dec 2026"; {time} is like
  // "9:00 am SGT".
  'email.class.instant': '{day}, {time}',

  // The receipt for a seat in a class. {className} is the class's name, {course} the course
  // title and {teacher} the teaching profile's name; {amount} is like "S$500.00". The times
  // follow email.classReceipt.when, one email.class.block each; {timeZone} is like "Singapore
  // Standard Time". {address} is the venue as the teacher typed it. {date} is when withdrawal for
  // a refund less the payment processing fee closes, an email.class.instant.
  'email.classReceipt.title': 'Your seat is booked: {className}',
  'email.classReceipt.paid':
    'Thanks for your purchase. You paid {amount} for a seat in "{className}", a class of "{course}" by {teacher}.',
  'email.classReceipt.when': 'The class meets at these times ({timeZone}):',
  'email.classReceipt.where': 'Where: {address}',
  'email.classReceipt.online':
    'The class is taught online. Your instructor will email you how to join.',
  'email.classReceipt.terms':
    'You can withdraw until {date}, as long as you have not attended a session, and we refund the price you paid less the payment processing fee that Stripe charged on your payment; after that date you cannot withdraw for a refund.',
  'email.classReceipt.button': 'View your class',

  // A payment for a seat that arrived when the seat was gone: the class had filled, started or
  // been cancelled. Sent once the whole payment has been returned. {amount} is like "S$500.00".
  'email.seatLost.title': 'No seat in {className}: your payment has been returned',
  'email.seatLost.lost':
    'Your payment for a seat in "{className}" arrived after the seat was no longer available, so you do not have a seat.',
  'email.seatLost.refunded':
    'We have returned the whole {amount} to your original payment method. It can take 5–10 working days to appear.',
  'email.seatLost.button': 'Go to the course',

  // The teacher changed a block's time in a class where the learner has a seat. The old and the
  // new times follow .before and .after, one email.class.block each. .withdraw is only for a
  // learner who may now withdraw with a full refund.
  'email.classTimesChanged.title': 'New times for {className}',
  'email.classTimesChanged.changed':
    'The teacher has changed the times of "{className}", a class you have a seat in.',
  'email.classTimesChanged.before': 'The times were ({timeZone}):',
  'email.classTimesChanged.after': 'The new times are ({timeZone}):',
  'email.classTimesChanged.withdraw':
    "If the new times do not suit you, you can withdraw on the class's page in Elevate for a full refund until the class starts.",
  'email.classTimesChanged.button': 'View your class',

  // The teacher marked the learner present by hand. {block} is one email.class.block line,
  // followed by the time zone's name; {date} is the last day the learner can dispute the mark.
  'email.manualMark.title': 'You were marked present: {className}',
  'email.manualMark.marked':
    'Your teacher marked you present by hand in "{className}" for the session on {block}.',
  'email.manualMark.dispute':
    "If you were not there, dispute the mark on the class's page in Elevate by {date}. After that it counts as attendance, and a refund for this class is the teacher's decision.",
  'email.manualMark.button': 'View your class',

  // The class was cancelled and the refund has been made. {amount} is like "S$500.00". .refunded
  // is for the whole payment; .refundedPart for a learner who attended part of the class.
  'email.classCancelled.title': 'Class cancelled: {className}',
  'email.classCancelled.cancelled': '"{className}" has been cancelled.',
  'email.classCancelled.refunded':
    'We have returned {amount} to your original payment method. It can take 5–10 working days to appear.',
  'email.classCancelled.refundedPart':
    'You attended part of the class, so we have returned {amount}, the share for the sessions that were not taught, to your original payment method. It can take 5–10 working days to appear.',
  'email.classCancelled.button': 'View your class',

  // The class was cancelled after every session had started, and the learner is counted as
  // having attended, so no refund is due.
  'email.classCancelledAttended.title': 'Class cancelled: {className}',
  'email.classCancelledAttended.body':
    '"{className}" has been cancelled. Every session had started and you are counted as having attended, so no refund is due. If you think this is wrong, contact the teacher.',
  'email.classCancelledAttended.button': 'View your class',

  // The class was cancelled while the learner's manual mark could still be disputed. {date} is
  // the last day to dispute it.
  'email.classCancelledMarkOpen.title': 'Class cancelled: {className}',
  'email.classCancelledMarkOpen.body':
    '"{className}" has been cancelled. You were marked present by hand, and you can dispute that mark until {date}.',
  'email.classCancelledMarkOpen.refund':
    'If you dispute it, your whole payment will be returned. If you do not, the mark counts as attendance, and only the share for any sessions that were not taught will be returned.',
  'email.classCancelledMarkOpen.button': 'View your class',

  // The learner withdrew and the refund has been made. {amount} is like "S$480.00".
  // .refundedLessFee when the payment processing fee was kept; .refundedFull otherwise.
  'email.seatWithdrawn.title': 'You have withdrawn from {className}',
  'email.seatWithdrawn.withdrawn':
    'You have withdrawn from "{className}" and no longer have a seat in it.',
  'email.seatWithdrawn.refundedLessFee':
    'We have returned {amount}, what you paid less the payment processing fee, to your original payment method. It can take 5–10 working days to appear.',
  'email.seatWithdrawn.refundedFull':
    'We have returned the whole {amount} to your original payment method. It can take 5–10 working days to appear.',
  'email.seatWithdrawn.button': 'Go to the course',

  // The teacher refunded part or all of a seat; the learner keeps the seat. {reason} is what the
  // teacher typed.
  'email.seatRefunded.title': 'A refund for {className}',
  'email.seatRefunded.refunded':
    'The teacher of "{className}" has refunded {amount} to your original payment method. It can take 5–10 working days to appear.',
  'email.seatRefunded.kept': 'You keep your seat in the class.',
  'email.seatRefunded.button': 'View your class',

  // The teacher moved the learner to another class of the course. {fromClass} and {className}
  // are the old and the new class. The new class's times follow .when, one email.class.block
  // each; {timeZone} is like "Singapore Standard Time".
  'email.seatMoved.title': 'Your class has changed: {className}',
  'email.seatMoved.moved':
    'The teacher has moved you from "{fromClass}" to "{className}", another class of "{course}".',
  'email.seatMoved.when': 'The new class meets at these times ({timeZone}):',
  'email.seatMoved.withdraw':
    "Because your class changed, you can withdraw on the class's page in Elevate for a full refund until the new class starts.",
  'email.seatMoved.button': 'View your class',
} as const
