/** Sign-in and verify. */
export const learnerAuthEn = {
  // Sign-in, the email step
  'learnerAuth.email.eyebrow': 'Sign in or create an account',
  'learnerAuth.email.title': 'Pick up where you left off.',
  'learnerAuth.email.body': 'We will email you a one-time link and a 6-digit code. No passwords.',
  'learnerAuth.email.label': 'Email',
  // An example address in the empty email field
  'learnerAuth.email.placeholder': 'you@example.com',
  'learnerAuth.email.invalid': 'Enter a valid email address',
  'learnerAuth.email.request': 'Email me a sign-in code',
  'learnerAuth.email.terms':
    'By continuing you agree to the Elevate terms. Teachers sign in at Elevate Teach.',

  // Sign-in, the code step
  'learnerAuth.code.eyebrow': 'Check your inbox',
  'learnerAuth.code.title': 'Enter the 6-digit code',
  // {email} is the address the code went to, shown in bold
  'learnerAuth.code.sentTo': 'We sent it to {email}.',
  // On the web, where the emailed link opens this site. {email} as above.
  'learnerAuth.code.sentToWeb': 'We sent it to {email}. You can also click the link in the email.',
  'learnerAuth.code.verify': 'Verify',
  'learnerAuth.code.changeEmail': 'Use a different email',
  'learnerAuth.code.resend': 'Resend code',

  'learnerAuth.browse': 'Browse courses without signing in',

  // Verify, the page the emailed link opens
  'learnerAuth.verify.signingIn': 'Signing you in…',
  'learnerAuth.verify.eyebrow': 'Sign-in link',
  'learnerAuth.verify.failed': 'We could not sign you in',
  // The link has no token, or one too short to be real
  'learnerAuth.verify.incomplete': 'This sign-in link is incomplete. Request a new one.',
  'learnerAuth.verify.requestNew': 'Request a new link',
} as const
