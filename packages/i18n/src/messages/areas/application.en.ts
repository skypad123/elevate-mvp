/** Where an application stands, and a company's set-up steps after approval. */
export const applicationEn = {
  // An application that Support has not approved. The badge beside its heading is
  // `status.profile.*`.
  // The small line above the heading: a person's application, and a company's
  'application.eyebrow.personal': 'Application',
  'application.eyebrow.company': 'Company application',
  // The heading: while Support is reading the application, and after Support has turned it down
  'application.title.applied': 'Under review',
  'application.title.rejected': 'Not approved yet',

  // Turned down. The note Support wrote is quoted under this line.
  'application.rejected.body':
    'The team could not approve the application as submitted. Their note:',
  // Button: opens the application form
  'application.editAndResubmit': 'Edit and resubmit',

  // Under review: one paragraph, made of a `reading` message and then `emailNotice`.
  // {name} is the profile's display name
  'application.reading.personal':
    'Thanks, {name}. A member of the Elevate team is reading the application.',
  // {legalName} is the company's registered name, {uen} its registration number
  'application.reading.company':
    'Thanks, {name}. A member of the Elevate team is reading the application, and comparing {legalName} (UEN {uen}) with the business profile you uploaded.',
  // {email} is the address of the profile's owner, shown in bold
  'application.emailNotice':
    'An email goes to {email} when it has been reviewed, usually within two working days.',
  // Joins the two: {first} is the `reading` message, {second} is `emailNotice`
  'application.sentences': '{first} {second}',
  // Button: opens the application form
  'application.edit': 'Edit application',
  // Button: asks again where things stand. Also under a company's set-up steps
  'application.checkStatus': 'Check status',

  // The note under the card: for a person, and for a company
  'application.next.personal':
    'While you wait: think about the first course you want to build. Most pilot teachers start with 3–5 lessons, a short video per lesson, a page of notes and a quick quiz.',
  'application.next.company':
    'After approval there are two more steps before courses can be sold: the company connects its own Stripe account, and Elevate checks that the legal name on that account matches the company.',

  // An approved company's steps before it can be paid
  // The small line above the heading. {name} is the profile's display name
  'companySetup.eyebrow': 'Setting up {name}',
  // The heading
  'companySetup.title': 'Two steps before you sell',
  'companySetup.intro':
    'The application is approved. The company can be paid, and its courses bought, once both steps below are done.',
  // What a screen reader says for the icon in front of each step
  'companySetup.step.done': 'Done',
  'companySetup.step.waiting': 'Waiting',
  'companySetup.step.notStarted': 'Not started',

  // The first step, which is always done
  'companySetup.approved.title': 'Application approved',
  // {legalName} is the company's registered name, {uen} its registration number
  'companySetup.approved.body': 'We checked {legalName} (UEN {uen}) against its business profile.',

  // The second step
  'companySetup.stripe.title': 'Connect the company’s Stripe account',
  // Where it stands: done; not begun; begun and left unfinished; all sent, and Stripe is checking
  'companySetup.stripe.verified': 'Stripe has verified the company and can take payments for it.',
  'companySetup.stripe.notConnected':
    'Stripe handles payments and payouts. Onboarding is done for the company, with its own bank account, and takes about ten minutes.',
  'companySetup.stripe.unfinished': 'Stripe onboarding was started and is not finished yet.',
  'companySetup.stripe.verifying':
    'Stripe is verifying the company’s details. This can take a day or two.',
  // Button, once onboarding has been started. Before that the button is `stripe.connect`.
  'companySetup.stripe.continue': 'Continue Stripe onboarding',
  // Shown instead of the button to a member who is not the owner. {email} is the owner's address
  'companySetup.stripe.ownerOnly': 'Only the profile’s owner, {email}, can connect Stripe.',

  // The third step
  'companySetup.name.title': 'Elevate checks the legal name',
  // Where it stands: the names match; Elevate is comparing them; Stripe has not finished yet.
  // A legal name often ends in a full stop ("Pte. Ltd."), so {legalName} never ends a sentence in
  // these three.
  'companySetup.name.matched':
    'The legal name on the Stripe account is {legalName}, the company we approved.',
  // {email} is the address of the profile's owner
  'companySetup.name.checking':
    'We are checking that the legal name on the Stripe account is {legalName}, the company we approved. This usually takes one working day, and an email goes to {email} when it is done. If the names differ, we will say what to change.',
  'companySetup.name.later':
    'When Stripe has finished, we check that the legal name on the Stripe account is {legalName}, the company we approved.',

  // After "Check status" when nothing has changed
  'application.checked': 'Still under review. Checked just now.',
} as const
