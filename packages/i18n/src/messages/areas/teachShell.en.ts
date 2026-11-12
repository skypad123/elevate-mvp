/** Teach's frame around every page: the profile switcher, the staff banner, profile not found. */
export const teachShellEn = {
  // The profile switcher: a select in the sidebar, and in the header of the set-up pages
  'switcher.label': 'Profile',
  // What a screen reader calls the select
  'switcher.ariaLabel': 'Switch profile',
  // The option shown while no profile is open; it cannot be chosen
  'switcher.placeholder': 'Your profiles…',
  // The options. {name} is the profile's display name; an approved profile shows its name alone.
  // The profile on screen, when Elevate staff have opened a profile they do not belong to
  'switcher.option.staff': '{name} (as staff)',
  // A profile Support has not decided on yet
  'switcher.option.applied': '{name} (under review)',
  // A profile Support has turned down
  'switcher.option.rejected': '{name} (not approved)',
  // The last option: opens the application form for a company
  'switcher.createCompany': '+ Create a company profile…',

  // The banner Elevate staff see above every page of a profile that is not theirs
  // In bold, and followed by the body in the same paragraph
  'staffBanner.title': 'You are acting as Elevate staff.',
  // {name} is the profile's display name
  'staffBanner.body':
    'This is {name}’s profile, not yours. You can fix content and read the profile; prices, publishing and payouts stay with the teacher. Every change you make is recorded under your name.',
  // Joins the two: {first} is the title, {second} the body
  'staffBanner.sentences': '{first} {second}',

  // Shown instead of the page when the profile in the address does not exist or is not the user's
  'profileNotFound.title': 'Profile not found',
  'profileNotFound.body':
    'This teaching profile does not exist, or your account is not part of it.',
  // Button: opens the profile the user last used, or the application form if they have none
  'profileNotFound.action': 'Go to your profiles',
} as const
