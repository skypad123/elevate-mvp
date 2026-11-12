/** Teach's Members page. */
export const membersEn = {
  // Page header
  'members.eyebrow': 'Members',
  'members.title': 'Members',
  'members.description':
    'People who work on this profile’s courses with you. Each signs in with their own account.',

  // Shown instead of the page to someone whose role may not see the member list
  'members.noAccess.title': 'Members are managed by the owner',
  'members.noAccess.body': 'Your role on this profile does not include its member list.',

  // The table of the owner and the members
  'members.list.title': 'On this profile',
  'members.list.loadFailed': 'Could not load members',
  // Table header: the person's name and email
  'members.list.person': 'Person',
  // Table header: the date the person was added to the profile
  'members.list.added': 'Added',
  // What a screen reader calls the select that changes a member's role. {name} is the member's
  // name, or their email if they have not given one.
  'members.list.roleOf': 'Role of {name}',
  // Under the date in the Added column. {name} is whoever added the member.
  'members.list.addedBy': 'by {name}',
  // Under the table when the owner is the only person on the profile
  'members.list.empty': 'Nobody else yet. Invite a writer to help build your courses.',

  // The table of invitations that have not been taken up yet
  'members.invitations.title': 'Invitations',
  // Table header: the address the invitation went to
  'members.invitations.sentTo': 'Sent to',
  // Under the address. {name} is whoever sent the invitation.
  'members.invitations.invitedBy': 'invited by {name}',
  // Badge: the link was used from another address, so the owner has to confirm the person
  'members.invitations.needsConfirmation': 'Needs confirmation',
  // Under that badge. {email} is the address the link was used from.
  'members.invitations.acceptedElsewhere':
    'Accepted from another address: {email}. They are not a member until the owner confirms.',
  // The same, when that address is not known
  'members.invitations.acceptedElsewhere.unknown':
    'Accepted from another address: unknown. They are not a member until the owner confirms.',
  // Badge: nobody has used the link yet
  'members.invitations.waiting': 'Waiting',
  // Under that badge. {date} is the day the link stops working.
  'members.invitations.expires': 'Link expires {date}',
  // Buttons on an invitation. Confirm: the owner accepts the person who used the link.
  'members.invitations.confirm': 'Confirm',
  'members.invitations.resend': 'Send again',
  'members.invitations.revoke': 'Revoke',

  // The card that sends an invitation
  'members.invite.title': 'Invite someone',
  'members.invite.description':
    'They get an email with a link. They sign in with their own address and accept.',
  // Shown when a writer is the only role that can be invited. {role} is the word below, in bold;
  // {summary} is what a writer can do (profileRole.writer.summary).
  'members.invite.joinsAs': 'They join as a {role}. {summary}',
  'members.invite.joinsAs.writer': 'writer',
  // Button
  'members.invite.submit': 'Send invitation',

  // The card shown in its place to someone who can read the list and not change it
  'members.readOnly.title': 'Read only',
  'members.readOnly.description':
    'You can see who is on this profile. Inviting and removing people is for the owner and managers.',

  // The card that explains the roles. The notes themselves are profileRole.*.
  'members.roles.title': 'What each role can do',

  // The dialog that asks before a member is removed. {name} is the member's name or email.
  'members.remove.title': 'Remove {name}?',
  'members.remove.description':
    'They lose access to this profile at once. Courses and files they worked on stay with the profile, and changes of theirs that are waiting for approval stay too.',

  // Toasts: a line shown for a few seconds once an action is done
  // A member's role was changed, or the owner confirmed an invitation. {name} is the person's
  // name or email.
  'members.toast.role.manager': '{name} is now a manager',
  'members.toast.role.writer': '{name} is now a writer',
  // An invitation was sent a second time
  'members.toast.resent': 'Sent again to {email}',
  'members.toast.revoked': 'Invitation revoked',
  // {name} is the member's name or email
  'members.toast.removed': '{name} was removed',
  'members.toast.invited': 'Invitation sent to {email}',
  'members.toast.invited.description': 'The link in the email works for 7 days.',
  // An invitation could not be sent. The error itself is shown under this title.
  'members.toast.inviteFailed': 'Could not send',
} as const
