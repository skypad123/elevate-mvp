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

  // Signed out in a browser: two ways to check in
  'learnerClass.signedOut.title': 'Sign in to check in',
  'learnerClass.signedOut.body': 'Check in with the Elevate app, or sign in on this page.',
  'learnerClass.signedOut.openApp': 'Open the Elevate app and type the code',
  'learnerClass.signedOut.signIn': 'Sign in here',
  'learnerClass.signedOut.fallback': 'If nothing happens, sign in here',
} as const
