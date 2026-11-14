/** Support's owner recovery. */
export const supportRecoveryEn = {
  // Owner recovery, for an owner who can no longer sign in; only a super admin sees it.
  // The button under the Owner card that opens it: on a personal profile, then on a company's
  'recovery.open.personal': 'Change the owner’s email',
  'recovery.open.company': 'Name a new owner',

  // A personal profile: the owner stays and gets a new sign-in address. The dialog's title
  'recovery.personal.title': 'Change the owner’s email address',
  // {email} is the address the owner has now, shown in bold
  'recovery.personal.description':
    'For an owner who can no longer sign in as {email}. Be sure who is asking: whoever reads the new address gets the profile, its courses and its earnings.',
  'recovery.personal.newEmail': 'New email address',
  'recovery.personal.newEmail.hint': 'It must not belong to another Elevate account.',
  // Under the field: what changing the address does
  'recovery.personal.effects':
    'The owner is signed out everywhere and signs in with the new address from now on. Both addresses are emailed. The change is recorded in the audit log under your name.',
  // Button
  'recovery.personal.confirm': 'Change address',

  // A company profile: the company names another person as its owner. The dialog's title
  'recovery.company.title': 'Name a new owner',
  // {email} is the present owner's address, shown in bold; {company} is the company's legal name
  'recovery.company.description':
    'For a company whose owner, {email}, has left or cannot sign in. An officer of {company} must authorise the change in writing.',
  // Label of the search field, and of the person once one is chosen
  'recovery.company.newOwner': 'New owner',
  'recovery.company.newOwner.hint':
    'Search by email or name. The new owner needs an Elevate account: ask them to sign in to Teach once.',
  // Under the search field while the search runs
  'recovery.company.searching': 'Searching…',
  // {search} is what was typed into the search field
  'recovery.company.noMatch': 'No other account matches “{search}”.',
  // Badge on a person in the results who is already on this profile
  'recovery.company.managerHere': 'Manager here',
  'recovery.company.writerHere': 'Writer here',
  // Button beside the chosen person: goes back to the search
  'recovery.company.newOwner.change': 'Change',
  // The upload of the company's written authorisation
  'recovery.company.authorisation': 'Officer’s authorisation (PDF)',
  'recovery.company.authorisation.hint':
    'A signed letter from a director or partner of the company that names the new owner. It is kept with the audit entry.',
  // Checkbox. {email} is the present owner's address
  'recovery.company.removePrevious': 'Remove {email} from the profile',
  // "They" is the present owner
  'recovery.company.removePrevious.hint':
    'Left unticked, they stay on the profile as a manager. Either way they are signed out.',
  // Under the form: what changing the owner does
  'recovery.company.effects':
    'Both people are emailed. The change is recorded in the audit log under your name.',
  // Button
  'recovery.company.confirm': 'Change owner',

  // Toasts. The title after a personal profile's recovery, and after a company's
  'recovery.toast.emailChanged': 'Owner’s email changed',
  'recovery.toast.ownerChanged': 'Owner changed',
  // The description under either title
  'recovery.toast.emailed': 'Both addresses have been emailed.',
  // Title of the toast when a recovery fails; the description is the error itself
  'recovery.toast.failed': 'Recovery failed',
} as const
