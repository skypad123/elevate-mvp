/**
 * Every API error code a learner can see. The learner app words each one from its message
 * `apiError.<code>` in @elevate/i18n, and the catalog test fails when one has no message. The API's
 * own English `message` is for logs, Support and the web portals; the learner app never shows it.
 *
 * Adding a code a learner can reach means adding it here and to the `apiError` area. Codes only
 * Teach, Support or internal paths produce aren't listed; the app shows a generic sentence for an
 * unlisted code. See ADR 010 and the Chinese learner design's error rule.
 */
export const USER_ERROR_CODES = [
  // Any request (middleware)
  'invalid_session', // the stored session expired or was revoked
  'unauthorized', // signed out on a route that needs a session
  'reauth_required', // an action that needs a recent sign-in
  'forbidden', // no access, the generic case
  'not_found', // "<thing> not found"
  'validation', // a field the app sent failed the API's schema
  'rate_limited', // too many requests from this client or account
  'payments_not_configured', // Stripe is not set up on this server

  // Sign-in (auth.service.ts)
  'link_invalid', // no open sign-in link or code for that email or token
  'link_used', // the link was used by another request first
  'link_expired',
  'code_locked', // five wrong codes
  'code_invalid',

  // Checkout (payments.service.ts)
  'promo_invalid', // no such code, or switched off
  'promo_wrong_course',
  'promo_not_started',
  'promo_expired',
  'promo_exhausted',
  'already_enrolled',
  'teacher_not_payable',
  'below_minimum', // details.minimumCents

  // Learning (learning.service.ts, media.service.ts)
  'enrollment_inactive', // refunded or cancelled
  'lesson_locked', // details.blockedByTitles on a lesson load
  'asset_not_ready', // a file still processing
  'quiz_completion', // a quiz marked complete without passing it
  'quiz_empty',
  'already_passed',
  'no_attempts_left',
  'already_submitted',
  'attempt_expired',

  // Certificates (certificates.service.ts)
  'not_complete',

  // Classes (attendance.service.ts)
  'check_in_not_open', // details.opensAt
  'check_in_closed', // details.closesAt
  'check_in_locked', // five wrong or expired codes; details.lockedUntil
  'check_in_code_wrong', // details.attemptsLeft
  'check_in_code_expired', // details.attemptsLeft
  'check_in_overturned', // the instructor overturned this block's check-in
  'dispute_window_closed', // details.disputeUntil
  'already_disputed',
] as const

export type UserErrorCode = (typeof USER_ERROR_CODES)[number]

export function isUserErrorCode(code: string): code is UserErrorCode {
  return (USER_ERROR_CODES as readonly string[]).includes(code)
}
