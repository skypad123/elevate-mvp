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

  // "Take it as a class": the classes of this course on sale, below the enrol card. A class is
  // the course taught live, on fixed dates, to a small group; a seat is its own purchase.
  'learnerCourse.class.title': 'Take it as a class',
  'learnerCourse.class.intro':
    'A class is this course taught live by an instructor on the dates shown. A seat is bought on its own and does not include the self-paced lessons.',
  // {name} is the instructor's name
  'learnerCourse.class.instructor': 'Taught by {name}',
  // {address} is the venue address the teacher typed
  'learnerCourse.class.venue': 'Venue: {address}',
  'learnerCourse.class.remote': 'Remote class',
  // {count} is the number of seats still free
  'learnerCourse.class.seatsLeft.one': '{count} seat left',
  'learnerCourse.class.seatsLeft.other': '{count} seats left',
  'learnerCourse.class.full': 'This class is full.',
  // The button on the web; it opens the class checkout page. {price} is like "S$500.00".
  'learnerCourse.class.book': 'Book this class · {price}',
  // The button in the phone app; it opens this page on the web with the class chosen
  'learnerCourse.class.bookOnWeb': 'Book on the web',
  // Phone app only, under the classes
  'learnerCourse.class.nativeNote':
    'Booking opens this page in your browser with the class chosen. Your seat appears here afterwards.',
  // The learner has a seat in this class; the link opens their class screen
  'learnerCourse.class.haveSeat': 'You have a seat',
  'learnerCourse.class.viewSeat': 'View your class',
  // The learner has a seat in a class of this course that is no longer listed (it has started)
  'learnerCourse.class.seatElsewhere': 'You have a seat in a class of this course.',
  // Shown on the chosen class after the learner left Stripe's checkout without paying
  'learnerCourse.class.cancelled':
    'Payment was cancelled, and your seat is no longer held. You can book again while seats are left.',
} as const
