/** Support's list of teaching profiles. */
export const supportProfilesEn = {
  // Page header
  'profiles.eyebrow': 'Profiles',
  'profiles.title': 'Teaching profiles',
  'profiles.description':
    'Review applications, approve or reject them, and look up any profile that sells courses.',

  // Tabs that filter the list: applications waiting for review, approved profiles, rejected
  // applications, and every profile
  'profiles.tab.applications': 'Applications',
  'profiles.tab.teachers': 'Teachers',
  'profiles.tab.rejected': 'Rejected',
  'profiles.tab.all': 'All profiles',

  // Placeholder of the search box
  'profiles.search.placeholder': 'Search profile, owner, UEN or legal name',

  // Shown in place of the table
  // Title when the list could not be loaded; the error itself is shown under it
  'profiles.loadError': 'Could not load profiles',
  // Title when there is nothing to list, and the line under it: after a search, and without one
  'profiles.empty.title': 'No profiles here',
  'profiles.empty.search': 'No profile matches that search.',
  'profiles.empty.list': 'This list is empty for now.',

  // Table headers. Owner, Status and Commission use shared keys
  'profiles.column.profile': 'Profile',
  // Personal or corporate
  'profiles.column.type': 'Type',
  // Whether learners can pay the profile yet
  'profiles.column.payments': 'Payments',
  // Above a column of dates: when the profile applied. Not the status "Applied"
  'profiles.column.applied': 'Applied',

  // Badges in the Payments column: the profile can take payments, or cannot yet
  'profiles.payable.yes': 'Can be paid',
  'profiles.payable.no': 'Not yet',
} as const
