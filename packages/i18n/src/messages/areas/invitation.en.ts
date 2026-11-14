/** The page an invitation link opens. */
export const invitationEn = {
  // The link does not lead to an invitation
  'invitation.notFound.title': 'Invitation not found',
  'invitation.notFound.body':
    'This link is not a valid invitation. Check that the whole link was copied from the email.',

  // Shown once the invitation was accepted from an address other than the one it was sent to.
  // {profile} is the name of the teaching profile.
  'invitation.almostThere.title': 'Almost there',
  'invitation.almostThere.body':
    'You accepted the invitation to {profile} from a different address from the one it was sent to. The owner has been asked to confirm that it is you. You will get an email when they do.',

  // An invitation that cannot be used any more: a title and the reason, by what happened to it
  'invitation.closed.expired.title': 'This invitation has expired',
  'invitation.closed.expired.body':
    'Invitations work for 7 days. Ask whoever invited you to send a new one.',
  'invitation.closed.revoked.title': 'This invitation is no longer valid',
  'invitation.closed.revoked.body':
    'It was withdrawn, or replaced by a newer one. Check your inbox for a later email, or ask for a new invitation.',
  'invitation.closed.accepted.title': 'This invitation was already used',
  'invitation.closed.accepted.body':
    'If it was you, the profile is in Elevate Teach under your account.',
  'invitation.closed.awaiting_confirmation.title': 'Waiting for the owner',
  'invitation.closed.awaiting_confirmation.body':
    'This invitation was used from a different address from the one it was sent to. The profile’s owner has been asked to confirm.',
  // Button under it, for a reader who is signed in
  'invitation.goToTeach': 'Go to Elevate Teach',

  // An invitation that can be accepted
  // Badge above the heading
  'invitation.badge': 'Invitation',
  // The heading, by the role offered. {profile} is the name of the teaching profile.
  'invitation.join.manager': 'Join {profile} as a manager',
  'invitation.join.writer': 'Join {profile} as a writer',
  // Under the heading. {name} is whoever sent the invitation. personal: the profile is that
  // person's own; corporate: it is a company's.
  'invitation.invitedBy.personal': '{name} invited you to work on their courses on Elevate.',
  'invitation.invitedBy.corporate':
    '{name} invited you to work on this company’s courses on Elevate.',
  // The same two, when the account that sent the invitation no longer exists
  'invitation.invitedBy.someone.personal':
    'Someone invited you to work on their courses on Elevate.',
  'invitation.invitedBy.someone.corporate':
    'Someone invited you to work on this company’s courses on Elevate.',
  // Button for a reader who is signed in. {email} is the address they are signed in with.
  'invitation.accept': 'Accept as {email}',
  // Under that button. {signOut} is a button inside the sentence; its text is nav.signOut.
  'invitation.notYou': 'Not you? {signOut} and sign in with the address you want to use.',
  // Button for a reader who is not signed in
  'invitation.signInToAccept': 'Sign in to accept',
  'invitation.newHere':
    'New to Elevate? Signing in with your email creates your account. There is no password to choose.',
  // The last line of the card. {date} is the day the invitation stops working.
  'invitation.expires': 'This invitation expires on {date}.',

  // Toast after accepting. {profile} is the profile's name.
  'invitation.toast.joined.manager': 'You joined {profile} as a manager',
  'invitation.toast.joined.writer': 'You joined {profile} as a writer',
  // The toast's second line, for a writer
  'invitation.toast.joined.writer.note':
    'Edits you make to a live course go to the owner or a manager for approval before learners see them.',
} as const
