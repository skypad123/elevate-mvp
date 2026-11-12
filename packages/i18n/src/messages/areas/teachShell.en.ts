/** Teach's frame around every page: the profile switcher, the staff banner, profile not found. */
export const teachShellEn = {
  // The profile switcher: a button in the sidebar (and in the header of the set-up pages) that
  // opens a menu of the user's profiles
  'switcher.label': 'Profile',
  // What a screen reader calls the button and the menu
  'switcher.ariaLabel': 'Switch profile',
  // Shown on the button while no profile is open
  'switcher.placeholder': 'Your profiles…',
  // The second line of each entry. {role} is Owner, Manager or Writer.
  'switcher.detail.approved': '{role}',
  'switcher.detail.applied': '{role} · under review',
  'switcher.detail.rejected': '{role} · not approved',
  // The profile on screen, when Elevate staff have opened a profile they do not belong to
  'switcher.detail.staff': 'As Elevate staff',
  // The last entry: opens the application form for a company
  'switcher.createCompany': 'Create a company profile',

  // The count beside "Courses" in the navigation, read out by screen readers
  'teachNav.changesWaiting.one': '1 course has changes waiting for approval',
  'teachNav.changesWaiting.other': '{count} courses have changes waiting for approval',

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

  // The page for someone signed in who is on no teaching profile yet
  'start.eyebrow': 'Elevate Teach',
  'start.title': 'Teach on Elevate',
  // Shown instead of the title's description right after the person left their last profile
  'start.left': 'You left {name}. You are not on any teaching profile now.',
  'start.description':
    'You are not on any teaching profile yet. Apply to teach, or join a profile you were invited to.',
  'start.person.title': 'Teach under your own name',
  'start.person.body': 'For one person, a sole proprietor included.',
  'start.person.action': 'Apply as a person',
  'start.company.title': 'Teach as a company',
  'start.company.body': 'For a private limited company or an LLP registered in Singapore.',
  'start.company.action': 'Apply as a company',
  'start.invited.title': 'Invited to a profile?',
  'start.invited.body':
    'Open the link in the invitation email. If you accepted it from another address, the profile’s owner has to confirm first; you will get an email when they do.',
} as const
