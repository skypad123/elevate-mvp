/**
 * What a learner reads when a request fails, by the API's error code. One key per code in
 * `USER_ERROR_CODES` (@elevate/core); the catalog test fails when one is missing. The app shows
 * these instead of the API's English `message`. Teach and Support use them once their pages adopt
 * the same rule (ADR 010).
 */
export const apiErrorEn = {
  'apiError.invalid_session': 'Your session has expired. Sign in again.',
  'apiError.unauthorized': 'Sign in to continue.',
  'apiError.reauth_required': 'Sign in again to continue. This step needs a recent sign-in.',
  'apiError.forbidden': 'You do not have access to this.',
  'apiError.not_found': 'We could not find that. It may have been removed.',
  'apiError.validation': 'Something you entered was not accepted. Check it and try again.',
  'apiError.rate_limited': 'Too many attempts. Try again in a few minutes.',
  'apiError.payments_not_configured': 'Payments are not available right now. Try again later.',

  'apiError.link_invalid': 'That sign-in link or code is not valid. Request a new one.',
  'apiError.link_used': 'That sign-in link was already used. Request a new one.',
  'apiError.link_expired': 'That sign-in link has expired. Request a new one.',
  'apiError.code_locked': 'Too many incorrect codes. Request a new one.',
  'apiError.code_invalid': 'That code is not right. Check the email and try again.',

  'apiError.promo_invalid': 'That promo code is not valid.',
  'apiError.promo_wrong_course': 'That promo code does not apply to this course.',
  'apiError.promo_not_started': 'That promo code is not active yet.',
  'apiError.promo_expired': 'That promo code has expired.',
  'apiError.promo_exhausted': 'That promo code has been fully redeemed.',
  'apiError.already_enrolled': 'You are already enrolled in this course.',
  'apiError.teacher_not_payable':
    'This teacher cannot accept payments yet. Please try again later.',
  // {amount} is the minimum charge, like "S$1.00"
  'apiError.below_minimum':
    'With this promo code the price is below the minimum we can charge ({amount}).',

  'apiError.enrollment_inactive': 'This enrolment is no longer active.',
  'apiError.lesson_locked': 'This lesson is locked. Finish the lessons before it first.',
  // {lessons} is the titles of the lessons to finish, joined like a list
  'apiError.lesson_locked.after': 'Finish {lessons} first.',
  'apiError.asset_not_ready': 'This file is still being prepared. Try again in a few minutes.',
  'apiError.quiz_completion': 'A quiz is completed by passing it.',
  'apiError.quiz_empty': 'This quiz has no questions yet.',
  'apiError.already_passed': 'You have already passed this quiz.',
  'apiError.no_attempts_left': 'You have used all your attempts at this quiz.',
  'apiError.already_submitted': 'This attempt was already submitted.',
  'apiError.attempt_expired': 'Time ran out for this attempt.',

  'apiError.not_complete': 'Finish the course to get your certificate.',
} as const
