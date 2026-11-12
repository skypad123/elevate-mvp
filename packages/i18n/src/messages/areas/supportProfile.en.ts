/** Support's page for one teaching profile. */
export const supportProfileEn = {
  // Title shown in place of the page when it could not be loaded; the error itself is under it
  'profileDetail.loadError': 'Could not load this profile',

  // Page header
  // Link back to the list of teaching profiles
  'profileDetail.back': 'Profiles',
  // Above the profile's name, by the type of profile
  'profileDetail.eyebrow.personal': 'Personal profile',
  'profileDetail.eyebrow.corporate': 'Corporate profile',
  // {email} is the owner's email address
  'profileDetail.ownedBy': 'Owned by {email}',
  // Button: opens the profile in the Teach portal, in a new tab
  'profileDetail.openInTeach': 'Open in Teach',
  // Buttons: each opens its dialog, where the same word confirms
  'profileDetail.reject': 'Reject',
  'profileDetail.approve': 'Approve',

  // Four figures under the header, each a label above a number or a date
  'profileDetail.stat.courses': 'Courses',
  // Under the number of courses. {count} is how many of them are live
  'profileDetail.stat.courses.live': '{count} live',
  // The number of payments the profile has received, and what that number counts
  'profileDetail.stat.sales': 'Sales',
  'profileDetail.stat.sales.hint': 'Paid enrolments',
  // An amount of money, and what has been taken off it
  'profileDetail.stat.netEarnings': 'Net earnings',
  'profileDetail.stat.netEarnings.hint': 'After Stripe fees, commission and refunds',
  // Above a date: when the profile applied. Not the status "Applied"
  'profileDetail.stat.applied': 'Applied',

  // The Application card
  'profileDetail.application.title': 'Application',
  // Under the title: before the application was reviewed, and after. {applied} and {reviewed}
  // are dates
  'profileDetail.application.applied': 'Applied {applied}',
  'profileDetail.application.appliedReviewed': 'Applied {applied} · reviewed {reviewed}',
  // Labels of what the applicant wrote. Headline and Bio use shared keys
  'profileDetail.application.credentials': 'Credentials',
  // Label of what Support wrote at the review: the note with an approval, or the reason for a
  // rejection
  'profileDetail.application.reviewNote': 'Review note',

  // The Teaching sample card: a video or a link the applicant sent to show how they teach
  'profileDetail.sample.title': 'Teaching sample',
  'profileDetail.sample.none': 'No sample provided.',

  // The Courses card
  'profileDetail.courses.title': 'Courses',
  'profileDetail.courses.description': 'Open a course to read it as a reviewer.',
  'profileDetail.courses.empty': 'This profile has no courses yet.',
  // Table headers. Status uses a shared key
  'profileDetail.courses.column.course': 'Course',
  'profileDetail.courses.column.price': 'Price',
  // Above a column of numbers: how many learners have enrolled
  'profileDetail.courses.column.enrolled': 'Enrolled',

  // The Owner card. Name and Email use shared keys
  'profileDetail.owner.title': 'Owner',
  'profileDetail.owner.description': 'The one person who holds this profile.',
  // Link to the owner's page in People
  'profileDetail.owner.open': 'Open this person',
  // What staff who are not super admins see in place of the owner-recovery button
  'profileDetail.owner.recoveryNote':
    'Only super admins can recover an owner who can no longer sign in.',

  // The Payout accounts card
  'profileDetail.payout.title': 'Payout accounts',
  'profileDetail.payout.description': 'The Stripe accounts this profile is paid through.',
  // In place of the accounts when there is none: for a personal profile, and for a company's
  'profileDetail.payout.none.personal':
    'None yet. The owner has not started Stripe onboarding, so the profile’s courses cannot be bought.',
  'profileDetail.payout.none.corporate':
    'None yet. The owner has not started Stripe onboarding for the company, so the profile’s courses cannot be bought.',
  // One account is a list of labels and values. Status, Stripe account and Legal name use shared
  // keys. No two labels of the list may read the same
  // Label, and its two values: whether the Stripe account is a company's or a person's
  'profileDetail.payout.kind': 'Kind',
  'profileDetail.payout.kind.company': 'Company',
  'profileDetail.payout.kind.individual': 'Individual',
  // Label: whether Stripe lets the account take payments from learners
  'profileDetail.payout.charges': 'Charges',
  // Label: whether Stripe lets the account pay its balance out to the bank
  'profileDetail.payout.payouts': 'Payouts',
  // The value of Charges and of Payouts
  'profileDetail.payout.enabled': 'Enabled',
  'profileDetail.payout.notEnabled': 'Not enabled',
  // The value of Legal name, on a company's account: Support recorded on {date} that the legal
  // name Stripe holds is the company's, or has not checked it yet
  'profileDetail.payout.legalName.matched': 'Matched {date}',
  'profileDetail.payout.legalName.notChecked': 'Not checked yet',
  // Label of the date the account became active: while it is active, and while it is not
  'profileDetail.payout.activeSince': 'Active since',
  'profileDetail.payout.firstActive': 'First active',

  // The Commission card
  'profileDetail.commission.title': 'Commission',
  'profileDetail.commission.description': 'Platform share of each sale after Stripe fees.',
  // Label of the profile's rate today, such as 15%
  'profileDetail.commission.current': 'Current',
  // Label of a number field, beside the Save button
  'profileDetail.commission.newRate': 'New rate (%)',
  // What staff who are not super admins see in place of the field
  'profileDetail.commission.superAdminOnly': 'Only super admins can change commission.',
  // Toast once a new rate is saved
  'profileDetail.commission.updated': 'Commission updated',

  // The dialog that approves the profile
  'profileDetail.approve.title': 'Approve this profile?',
  // Under the title, for a personal profile and for a company's. {legalName} and {uen} are the
  // company's legal name and its UEN; its business profile is the registry document it uploaded
  'profileDetail.approve.description.personal':
    'Its owner can connect Stripe and build courses straight away. They get an email.',
  'profileDetail.approve.description.corporate':
    'Approving records that you checked {legalName} (UEN {uen}) against its business profile. Its owner can then connect the company’s Stripe account, and gets an email.',
  // Label of a text field
  'profileDetail.approve.note': 'Internal note (optional)',
  // Toast once the profile is approved
  'profileDetail.approve.done': 'Profile approved',

  // The dialog that rejects the application
  'profileDetail.reject.title': 'Reject this application',
  'profileDetail.reject.description':
    'The reason is emailed to the owner. They can update the application and resubmit.',
  // Label of a text field
  'profileDetail.reject.reason': 'Reason (sent to the owner)',
  // Toast once the application is rejected
  'profileDetail.reject.done': 'Application rejected',
} as const
