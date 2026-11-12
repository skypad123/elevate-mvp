/** Teach's Settings page: the profile form, the picture, the member's own role, the account card. */
export const teachSettingsEn = {
  // The profile form. Its field labels are `profileField.*`.
  // Button
  'settings.teach.save': 'Save changes',
  // Toast once the form is saved
  'settings.teach.saved': 'Profile saved',
  // Title of the toast when saving fails; the description is the error itself
  'settings.teach.saveFailed': 'Could not save',

  // The profile picture card
  'settings.teach.picture': 'Profile picture',
  'settings.teach.picture.description':
    'Shown beside your name on course pages. A square JPG, PNG or WebP works best.',
  // Button
  'settings.teach.picture.remove': 'Remove picture',
  // The label above the uploader: when the profile has no picture, and when it has one
  'settings.teach.picture.upload': 'Upload a picture',
  'settings.teach.picture.replace': 'Replace picture',
  // Toasts
  'settings.teach.picture.saved': 'Picture saved',
  'settings.teach.picture.removed': 'Picture removed',
  // Title of the toast when saving the picture fails; the description is the error itself
  'settings.teach.picture.saveFailed': 'Could not save picture',

  // The card a manager or writer sees: their role, and the way to leave the profile
  // Card title. {role} is the name of the role: Manager or Writer
  'membership.yourRole': 'Your role: {role}',
  // Button: opens the dialog below
  'membership.leave': 'Leave this profile',
  // The dialog. {name} is the profile's display name
  'membership.leave.title': 'Leave {name}?',
  'membership.leave.description':
    'You lose access to this profile and its courses at once. What you wrote stays with the profile. To come back you need a new invitation.',
  // Its buttons: close the dialog and stay a member, or leave
  'membership.leave.stay': 'Stay',
  'membership.leave.confirm': 'Leave',
  // Toast after leaving. {name} is the profile's display name
  'membership.leave.done': 'You left {name}',
  // Title of the toast when leaving fails; the description is the error itself
  'membership.leave.failed': 'Could not leave',

  // The Account card: two labels, each beside an email address
  // The user's own address
  'account.signedInAs': 'Signed in as',
  // The address of the profile's owner
  'account.owner': 'Owner',
} as const
