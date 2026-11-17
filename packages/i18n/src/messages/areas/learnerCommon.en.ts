/**
 * Text shared across the learner app: the language switch, error sentences the app words itself,
 * durations, the "Free" price, the list separator, and the empty, error and not-found screens.
 */
export const learnerCommonEn = {
  // The label of the English/中文 switch on Explore and sign-in
  'learnerCommon.language.label': 'Language',

  // A request failed and the API's code says nothing more (or there was no code)
  'learnerCommon.error.generic': 'Something went wrong. Try again.',
  // The request never reached Elevate: offline, or the server is down
  'learnerCommon.error.unreachable': 'Cannot reach Elevate. Check your connection.',
  'learnerCommon.error.retry': 'Try again',

  // Durations. {minutes} and {hours} are whole numbers.
  'learnerCommon.duration.minutes': '{minutes} min',
  'learnerCommon.duration.hours': '{hours} h',
  'learnerCommon.duration.hoursMinutes': '{hours} h {minutes} min',

  // Joins the items of a list: "a, b, c"
  'learnerCommon.list.separator': ', ',

  // A course with no price
  'learnerCommon.price.free': 'Free',

  // The page for an address the app has no route for
  'learnerCommon.notFound.title': 'That page is not on the map',
  'learnerCommon.notFound.body': 'The link may be old, or the course may have been taken down.',
  'learnerCommon.notFound.back': 'Back to Explore',

  // The screen shown when a route throws
  'learnerCommon.rootError.title': 'Something went wrong',
  // The body of the screen shown when a route throws
  'learnerCommon.rootError.body': 'An unexpected error interrupted this screen.',
} as const
