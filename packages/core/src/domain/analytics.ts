export const ANALYTICS_EVENTS = {
  signIn: 'sign_in',
  courseViewed: 'course_viewed',
  checkoutStarted: 'checkout_started',
  checkoutCompleted: 'checkout_completed',
  lessonStarted: 'lesson_started',
  lessonCompleted: 'lesson_completed',
  quizSubmitted: 'quiz_submitted',
  courseCompleted: 'course_completed',
  certificateIssued: 'certificate_issued',
  teacherApplied: 'teacher_applied',
  teacherApproved: 'teacher_approved',
  courseSubmitted: 'course_submitted',
  courseApproved: 'course_approved',
  courseRejected: 'course_rejected',
  firstPayout: 'first_payout',
  refundIssued: 'refund_issued',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
