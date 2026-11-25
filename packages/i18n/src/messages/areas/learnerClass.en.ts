/**
 * Scheduled classes in the learner app: the "Your classes" section of My Learning, the class
 * screen (class/[enrollmentId]) and the check-in screen (class/check-in/[blockId]).
 */
export const learnerClassEn = {
  // My Learning: the learner's class enrolments, above their courses
  'learnerClass.list.title': 'Your classes',
  // {time} is the next session's day and times, as 'learnerClass.block.time' words them
  'learnerClass.list.next': 'Next: {time}',
  'learnerClass.list.ended': 'All sessions have ended.',

  // A session's day and times in the class's time zone: "Tue, 2 Dec 2026, 9:00 am – 12:00 pm SGT"
  'learnerClass.block.time': '{day}, {start} – {end}',
  // An instant in the class's time zone, for a check-in that opens or closes: "Tue, 2 Dec, 8:30 am SGT"
  'learnerClass.instant': '{day}, {time}',

  // The class screen
  'learnerClass.class.backToLearning': 'My Learning',
  'learnerClass.class.loadError': 'Could not open this class',
  'learnerClass.class.notFound': 'This class is not in your classes.',
  // {course} is the course title the class runs
  'learnerClass.class.course': 'Course: {course}',
  // {address} is the venue address the teacher typed
  'learnerClass.class.venue': 'Venue: {address}',
  'learnerClass.class.remote': 'Remote class',
  'learnerClass.class.sessions': 'Sessions',
  'learnerClass.class.checkIn': 'Check in',

  // A learner's state in one session, by the stored value
  'learnerClass.state.marked_by_hand': 'Present, marked by your instructor',
  'learnerClass.state.present': 'Present',
  'learnerClass.state.present_flagged': 'Present, flagged',
  'learnerClass.state.mark_voided': 'Mark voided',
  'learnerClass.state.overturned': 'Check-in overturned',
  'learnerClass.state.not_arrived': 'Not checked in',

  // Why a check-in is flagged, by the stored location status
  'learnerClass.flag.out_of_range': 'Your location was far from the venue.',
  'learnerClass.flag.inaccurate': 'Your location reading was not precise enough.',
  'learnerClass.flag.denied': 'You did not share your location.',
  'learnerClass.flag.unavailable': 'No location reading was received.',
  'learnerClass.flag.unsupported': 'You checked in from the app, which does not read location.',

  // A manual mark. {reason} is a 'learnerClass.markReason' label, or the instructor's own note
  'learnerClass.mark.title': 'Marked present by your instructor: {reason}',
  'learnerClass.markReason.phone_not_working': 'phone not working',
  'learnerClass.markReason.no_phone': 'no phone',
  'learnerClass.markReason.no_network': 'no network',
  'learnerClass.markReason.app_problem': 'a problem with the app',
  'learnerClass.markReason.other': 'another reason',

  // Where a manual mark stands, by its sub-state. {date} is the last day it can be disputed.
  'learnerClass.subState.upheld': 'You disputed this mark, and it was upheld.',
  'learnerClass.subState.disputed': 'You disputed this mark. It is being reviewed.',
  'learnerClass.subState.settled': 'The time to dispute this mark has passed.',
  'learnerClass.subState.open': 'If this was not you, you can dispute it until {date}.',

  // An overturned check-in. {reason} is a 'learnerClass.overturnReason' label
  'learnerClass.overturn.title': 'Your instructor overturned this check-in: {reason}',
  'learnerClass.overturnReason.not_in_room': 'not in the room',
  'learnerClass.overturnReason.wrong_person': 'checked in by someone else',
  'learnerClass.overturnReason.other': 'another reason',

  // Disputing a manual mark
  'learnerClass.dispute.action': 'This was not me',
  'learnerClass.dispute.label': 'Tell the teaching team what happened',
  'learnerClass.dispute.placeholder': 'For example: I was not at this session.',
  'learnerClass.dispute.required': 'Write a short note before you send the dispute.',
  'learnerClass.dispute.submit': 'Send dispute',
  'learnerClass.dispute.cancel': 'Cancel',

  // The check-in screen
  'learnerClass.checkIn.title': 'Check in to your class',
  'learnerClass.checkIn.loadError': 'Could not open this check-in',
  'learnerClass.checkIn.codeLabel': 'Check-in code',
  'learnerClass.checkIn.codeFromLink': 'The code from the link is filled in.',
  'learnerClass.checkIn.typeCode': 'Type the code showing now on your instructor’s screen.',
  'learnerClass.checkIn.locationTitle': 'Why Elevate asks for your location',
  'learnerClass.checkIn.locationBody':
    'When you press Check in, your browser asks once for your location, so your instructor can see you are at the venue. You can refuse and still check in.',
  'learnerClass.checkIn.submit': 'Check in',
  'learnerClass.checkIn.done': 'You are checked in',
  'learnerClass.checkIn.already': 'You are already checked in',
  'learnerClass.checkIn.overturned':
    'Your check-in for this session was overturned. Speak to your instructor.',
  'learnerClass.checkIn.viewClass': 'View your class',
  'learnerClass.checkIn.myLearning': 'My Learning',

  // A refused check-in, worded from the API's code and its details. {count} is the tries left.
  'learnerClass.checkIn.codeWrong.one':
    'That code is not right. Type the code showing now. You have {count} try left.',
  'learnerClass.checkIn.codeWrong.other':
    'That code is not right. Type the code showing now. You have {count} tries left.',
  'learnerClass.checkIn.codeWrong.none':
    'That code is not right. That was your last try for now: wait five minutes, then type the code showing then.',
  'learnerClass.checkIn.codeExpired.one':
    'That code has expired. Type the code showing now. You have {count} try left.',
  'learnerClass.checkIn.codeExpired.other':
    'That code has expired. Type the code showing now. You have {count} tries left.',
  'learnerClass.checkIn.codeExpired.none':
    'That code has expired. That was your last try for now: wait five minutes, then type the code showing then.',
  // {time} is an instant, as 'learnerClass.instant' words it
  'learnerClass.checkIn.lockedUntil': 'Too many wrong codes. Try again after {time}.',
  'learnerClass.checkIn.notOpenUntil': 'Check-in for this session opens at {time}.',
  'learnerClass.checkIn.closedAt': 'Check-in for this session closed at {time}.',

  // The seat card on the class screen: withdrawing, a move or a changed class, a refund, and a
  // cancelled class. {date} is an instant, as 'learnerClass.instant' words it, unless a comment
  // says it is a day. {amount} is like "S$480.00".
  'learnerClass.seat.title': 'Your seat',
  'learnerClass.seat.moved':
    'You were moved to this class by the teacher. We emailed you the new times.',
  'learnerClass.seat.timesChanged':
    "This class's times changed after you paid. We emailed you the old and the new times.",
  // learner_withdrew: what is returned is the price less the fee Stripe charged on the payment
  'learnerClass.seat.withdrawAmount':
    'You can withdraw until {date}. We would refund {amount}: the price you paid less the payment processing fee Stripe charged on your payment.',
  // Before Stripe's fee is known, the rates of the refund terms stand in for the amount
  'learnerClass.seat.withdrawRate':
    'You can withdraw until {date}. We would refund the price you paid less the payment processing fee Stripe charged on your payment: 3.4% of the price plus S$0.50 for a card issued in Singapore, 3.9% plus S$0.50 for a card issued outside Singapore, or 1.3% for PayNow, with Goods and Services Tax where Stripe charges it. The exact amount shows here once Stripe has reported it.',
  // changed_withdrew: the full refund after a move or a changed time, until the class starts
  'learnerClass.seat.withdrawFullAmount':
    'Because the class changed, you can withdraw until it starts on {date}, and we would refund the full {amount}.',
  'learnerClass.seat.withdrawFull':
    'Because the class changed, you can withdraw until it starts on {date}, and we would refund the price you paid in full.',
  'learnerClass.seat.withdraw': 'Withdraw',
  'learnerClass.seat.confirmTitle': 'Withdraw from this class?',
  'learnerClass.seat.confirmBody':
    'You lose your seat at once, and it can go to someone else. This cannot be undone.',
  'learnerClass.seat.confirm': 'Yes, withdraw',
  'learnerClass.seat.keep': 'Keep my seat',
  'learnerClass.seat.closedTitle': 'Withdrawal has closed',
  'learnerClass.seat.closed':
    "Withdrawal closed 7 days before the first session. A refund is now the teacher's decision: contact the teacher.",
  'learnerClass.seat.attended':
    "You have attended this class, so a refund is the teacher's decision.",
  // {date} is a day: the last day the learner's manual mark can be disputed
  'learnerClass.seat.markOpen':
    'You were marked present by hand. Until {date} you cannot withdraw unless you dispute the mark first, below.',

  // The latest refund of the seat
  'learnerClass.refund.onItsWay': 'Refund on its way',
  'learnerClass.refund.onItsWayAmount':
    'We are returning {amount} to the payment method you paid with, and we email you when it has been sent.',
  'learnerClass.refund.onItsWayBody':
    'We are returning your money to the payment method you paid with, and we email you when it has been sent.',
  'learnerClass.refund.refunded': 'Refunded',
  // {date} is a day
  'learnerClass.refund.refundedBody':
    'We returned {amount} to the payment method you paid with on {date}. A refund to a card usually shows on your statement 5 to 10 business days later.',
  'learnerClass.refund.bankReturned':
    'Your bank returned your payment to you, so no refund is needed.',
  'learnerClass.refund.support': "Elevate's support team has dealt with this refund.",
  'learnerClass.refund.withdrawn': 'You withdrew from this class, and you no longer have a seat.',
  // A refund the teacher chose to give; the learner keeps the seat
  'learnerClass.refund.discretionary': 'The teacher gave you a refund. You keep your seat.',

  // A cancelled class, in one of three states
  'learnerClass.cancelled.title': 'This class was cancelled',
  'learnerClass.cancelled.refundFull': 'We refund the price you paid in full.',
  'learnerClass.cancelled.refundPart':
    'You attended part of the class, so we refund the part of the price for the sessions that had not started when it was cancelled.',
  // {date} is a day: the last day the learner's manual mark can be disputed
  'learnerClass.cancelled.markOpen':
    'You were marked present by hand, and you can dispute the mark until {date}. If you dispute it, we refund the price you paid in full. If you do not, the mark counts as attendance, and we refund the part of the price for any sessions that had not started.',
  'learnerClass.cancelled.attended':
    'Every session had started and you are counted as having attended, so no refund is due. If you think this is wrong, contact the teacher.',

  // Signed out in a browser: two ways to check in
  'learnerClass.signedOut.title': 'Sign in to check in',
  'learnerClass.signedOut.body': 'Check in with the Elevate app, or sign in on this page.',
  'learnerClass.signedOut.openApp': 'Open the Elevate app and type the code',
  'learnerClass.signedOut.signIn': 'Sign in here',
  'learnerClass.signedOut.fallback': 'If nothing happens, sign in here',
} as const
