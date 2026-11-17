/** The course detail page. */
export const learnerCourseEn = {
  // The course page could not be loaded; the error's own sentence shows under it
  'learnerCourse.notFound.title': 'Course not found',
  'learnerCourse.notFound.back': 'Back to Explore',
  // The back link at the top of the page, to the Explore tab
  'learnerCourse.back': 'Explore',

  'learnerCourse.badge.enrolled': 'Enrolled',

  // The enrol card: its eyebrow, for an enrolled learner and for anyone else
  'learnerCourse.cta.eyebrowEnrolled': 'You are enrolled',
  'learnerCourse.cta.eyebrow': 'One payment, lifetime access',
  'learnerCourse.cta.continue': 'Continue learning',
  'learnerCourse.cta.enrolFree': 'Enrol for free',
  // The enrol button on the web for a paid course. {price} is like "S$120.00".
  'learnerCourse.cta.enrolPrice': 'Enrol · {price}',
  // The enrol button in the phone app for a paid course; it opens the web page to pay
  'learnerCourse.cta.enrolOnWeb': 'Enrol on the web',
  'learnerCourse.cta.fees': 'All fees included. Secure payment by Stripe.',
  // Shown after the learner left Stripe's checkout without paying
  'learnerCourse.cta.cancelled': 'Payment was cancelled. You can try again whenever you like.',
  // Phone app only, under a paid course's enrol button
  'learnerCourse.cta.nativeNote':
    'Checkout opens in your browser; your enrolment appears here afterwards.',

  // The course's facts. {count} is a whole number.
  'learnerCourse.lessons.one': '{count} lesson',
  'learnerCourse.lessons.other': '{count} lessons',
  // An item is one video, audio, document or quiz in a lesson
  'learnerCourse.items.one': '{count} item',
  'learnerCourse.items.other': '{count} items',
  // {lessons} is learnerCourse.lessons.*, {items} is learnerCourse.items.*: "4 lessons · 12 items"
  'learnerCourse.facts.lessonsItems': '{lessons} · {items}',
  // {duration} is like "2 h 5 min"
  'learnerCourse.facts.duration': 'About {duration}',
  // The course has no timed media, so no length is shown
  'learnerCourse.facts.selfPaced': 'Self-paced',
  // {count} is how many learners have enrolled
  'learnerCourse.facts.enrolled': '{count} enrolled',

  'learnerCourse.learn.title': 'What you will learn',
  // A lesson's line in the list: {items} is learnerCourse.items.*, {duration} like "12 min"
  'learnerCourse.lesson.itemsDuration': '{items} · {duration}',
  'learnerCourse.about.title': 'About this course',
  'learnerCourse.teacher.eyebrow': 'Your teacher',
} as const
