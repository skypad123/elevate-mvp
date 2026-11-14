/** Stripe on Teach: the Stripe card, the toasts of its buttons, the pages Stripe sends the owner back to. */
export const paymentsEn = {
  // The Payments card, on the dashboard and on Settings
  'payments.title': 'Payments',
  // Under the title, by the state of the Stripe account: learners can pay; Stripe's side is done
  // but Elevate has not matched a company's legal name yet; not connected, or not finished
  'payments.description.enabled':
    'Learners can pay you. Payouts land in your bank on Stripe’s schedule.',
  'payments.description.nameCheck':
    'The Stripe account is connected. Courses can be bought once Elevate has matched its legal name to the company.',
  'payments.description.connect':
    'Connect a Stripe account so learners can pay you. Takes about five minutes.',
  // Badges: the same states, and "connected but onboarding not finished"
  'payments.badge.enabled': 'Payments enabled',
  'payments.badge.nameCheck': 'Name check pending',
  'payments.badge.onboarding': 'Onboarding incomplete',
  'payments.badge.notConnected': 'Not connected',
  // Shown while Elevate checks a company's legal name
  'payments.nameCheck.note':
    'Elevate compares the legal name on the Stripe account with the company. If they differ, the owner gets an email that says what to change in Stripe.',
  // What a manager or writer sees in place of the buttons
  'payments.ownerOnly': 'Only the profile’s owner can connect Stripe or open its dashboard.',
  // Button: goes back to Stripe's onboarding form, which was started but not finished
  'payments.finishOnboarding': 'Finish Stripe onboarding',
  // {rate} is a percentage, such as 15%
  'payments.commission': 'Commission on your courses: {rate}',
  'payments.verifying': 'Stripe is verifying your details.',

  // Toast when a Stripe button needs a fresh sign-in; the user is then taken to the sign-in page
  'payments.reauth.title': 'Sign in again to continue',
  'payments.reauth.description': 'Managing payouts needs a sign-in from the last 24 hours.',

  // The page Stripe sends the owner back to after onboarding
  // Beside a spinner
  'payments.return.checking': 'Checking your Stripe account…',
  // Toasts, a title and a description each: learners can pay now
  'payments.return.connected.title': 'Stripe connected',
  'payments.return.connected.description': 'Learners can now pay for your courses.',
  // A company: Stripe's side is done, Elevate's check of the legal name comes next
  'payments.return.nameCheck.title': 'Stripe is set up',
  'payments.return.nameCheck.description':
    'Elevate now checks the legal name on the account. We will email you when your courses can be bought.',
  // Stripe wants more from the owner
  'payments.return.incomplete.title': 'Almost there',
  'payments.return.incomplete.description':
    'Stripe still needs a few details before payments are enabled.',
  // Title of the toast when the account could not be read; the description is the error itself
  'payments.return.failed': 'Could not check Stripe status',

  // The page Stripe sends the owner to when an onboarding link has expired. Beside a spinner
  'payments.refresh.redirecting': 'Taking you back to Stripe…',
} as const
