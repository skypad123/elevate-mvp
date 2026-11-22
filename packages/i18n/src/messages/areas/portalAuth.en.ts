/**
 * The sign-in and verify pages that Teach and Support share (`@elevate/web-ui/portal`). A failed
 * sign-in is worded from its error code with `apiError.<code>`; see `signInErrorKey`.
 */
export const portalAuthEn = {
  // The first step: the visitor types their email address. The heading is the portal's name,
  // "Elevate Teach" or "Elevate Support", which stays as it is.
  // The small line above the heading
  'portalAuth.signIn.eyebrow': 'Sign in',
  // Field label and its placeholder, an example address
  'portalAuth.signIn.emailLabel': 'Email',
  'portalAuth.signIn.emailPlaceholder': 'you@example.com',
  // The button. The email holds both a link and a six-digit code
  'portalAuth.signIn.request': 'Email me a sign-in code',
  // Under the field when what was typed is not an email address
  'portalAuth.signIn.invalidEmail': 'Enter a valid email address',
  // Under the button. {back} is a link labelled `common.back` that leaves the page
  'portalAuth.signIn.noPasswords': 'One-time link and code, no passwords. {back}',

  // The second step, once the email is sent
  'portalAuth.code.eyebrow': 'Check your inbox',
  'portalAuth.code.title': 'Enter the 6-digit code',
  // {email} is the address the code was sent to, shown in bold
  'portalAuth.code.sentTo':
    'We sent a sign-in link and code to {email}. Click the link, or type the code here.',
  // Field label and its placeholder, an example code
  'portalAuth.code.label': 'Code',
  'portalAuth.code.placeholder': '123 456',
  // The button that checks the code
  'portalAuth.code.verify': 'Verify',
  // Goes back to the first step
  'portalAuth.code.differentEmail': 'Use a different email',
  // Sends another email with a new link and code
  'portalAuth.code.resend': 'Resend',

  // The page the emailed link opens
  // While the link is being checked
  'portalAuth.verify.signingIn': 'Signing you in…',
  // When it fails: the small line, the heading, then the reason (an `apiError.*` sentence or
  // `portalAuth.verify.incomplete`)
  'portalAuth.verify.eyebrow': 'Sign-in link',
  'portalAuth.verify.title': 'We could not sign you in',
  // The reason when the link was cut short, for example by copying only part of it
  'portalAuth.verify.incomplete': 'This sign-in link is incomplete. Request a new one.',
  // Opens the first step to ask for a new email
  'portalAuth.verify.requestNew': 'Request a new link',
  // Leaves for the portal's home page
  'portalAuth.verify.back': 'Back to start',

  // One line under the portal's name on the first step, saying what the portal is for
  'portalAuth.blurb.teach': 'Author courses, submit them for review and get paid through Stripe.',
  'portalAuth.blurb.support': 'Internal tools: review courses, approve teachers, manage payments.',
} as const
