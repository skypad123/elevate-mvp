/** Support's company card and legal-name check. */
export const supportCompanyEn = {
  // The Company card on a corporate profile: the company's details and Support's check of them.
  // Its Legal name, UEN and Legal form rows use the shared `company.*` and `entityType.*` keys.
  'companyCard.title': 'Company',
  // Where Support's check of the company stands, by check status: `.label` is the badge beside
  // the title, `.description` the line under the title
  'companyCard.check.pending.label': 'Not checked yet',
  'companyCard.check.pending.description':
    'Compare these details with the business profile before you approve. Approving records the company as verified.',
  'companyCard.check.verified.label': 'Verified',
  'companyCard.check.verified.description':
    'Checked against the business profile when the application was approved.',
  'companyCard.check.rejected.label': 'Rejected',
  'companyCard.check.rejected.description':
    'The application was rejected. Its owner can correct it and send it again.',
  // Label of the date on which Support checked the company
  'companyCard.checked': 'Checked',
  // The value beside that label when it is known who checked: {name} is that staff member's
  // email address. When it is not known, the date stands alone.
  'companyCard.checked.by': '{date} by {name}',
  // Label of the reason Support gave for rejecting the application
  'companyCard.rejectionReason': 'Rejection reason',
  // Label of the registry document the company uploaded (its business profile from ACRA)
  'companyCard.registryDocument': 'Business profile',
  // Shown in place of the document when the company has none
  'companyCard.registryDocument.none': 'None on file. Only the seeded demo companies have none.',

  // The Legal-name check card on an approved corporate profile: the legal name Stripe holds for
  // the company's account, beside the company Support approved
  'nameCheck.title': 'Legal-name check',
  'nameCheck.description':
    'A company is paid only when the legal name on its Stripe account is the company approved here.',
  // Badge beside the title: where the check stands
  'nameCheck.state.match': 'Names match',
  'nameCheck.state.mismatch': 'Names do not match',
  'nameCheck.state.waiting': 'Waiting for a check',
  'nameCheck.state.notStarted': 'Not started',
  // Shown instead of the two names while the company has no Stripe account
  'nameCheck.notStarted':
    'The company has not started Stripe onboarding, so there is no Stripe name to compare yet.',

  // The two names, side by side. Caption of the box with the legal name Stripe holds
  'nameCheck.stripeName': 'On the Stripe account',
  // In that box when Stripe's API gave no name, so it has to be read in the Stripe dashboard
  'nameCheck.stripeName.notReturned': 'Stripe returned no legal name',
  // In that box when the name Stripe holds is empty
  'nameCheck.stripeName.none': 'No legal name yet',
  // Link under the Stripe name, after the account's id: opens the account in the Stripe dashboard
  'nameCheck.openInStripe': 'Open in Stripe',
  // Caption of the box with the company's legal name; its UEN is under it (`company.uenValue`)
  'nameCheck.companyName': 'The company approved here',

  // The field for the name as read in the Stripe dashboard, shown when Stripe's API gave none
  'nameCheck.dashboardName': 'Legal name shown in the Stripe dashboard',
  'nameCheck.dashboardName.hint':
    'Stripe’s API returned no legal name for this account. Open the account in Stripe, and type the legal name exactly as it is shown there. It is kept with the audit entry.',

  // The box that shows the last decision while it is a mismatch. Its first line, in bold, without
  // a full stop: {name} is the email address of the staff member who recorded the mismatch
  'nameCheck.mismatch.recorded': 'Recorded as a mismatch on {date}',
  'nameCheck.mismatch.recordedBy': 'Recorded as a mismatch on {date} by {name}',
  // Its second line; the note itself follows on the next line. {name} is the legal name Stripe
  // showed when the mismatch was recorded
  'nameCheck.mismatch.stripeShowed': 'Stripe showed “{name}”. The owner was sent this note:',
  // The same line when Stripe showed no legal name
  'nameCheck.mismatch.stripeShowedNothing':
    'Stripe showed “no legal name”. The owner was sent this note:',

  // The paragraph under the names: two sentences, put together by `nameCheck.sentences`.
  // First, what is recorded. {name} is the email address of the staff member who recorded the match
  'nameCheck.record.match': 'Recorded as a match on {date}.',
  'nameCheck.record.matchBy': 'Recorded as a match on {date} by {name}.',
  // While the last decision is a mismatch
  'nameCheck.record.checkAgain':
    'Check again when the owner says the Stripe account has been corrected.',
  'nameCheck.record.none': 'No check is recorded yet.',
  // Second, what that means for the company's payout account
  'nameCheck.account.active': 'The account is active, so the company’s courses can be bought.',
  'nameCheck.account.chargesOff':
    'Stripe has not enabled charges for this account. A match recorded now takes effect when it does.',
  'nameCheck.account.chargesOn':
    'Stripe has enabled charges. The account becomes active when a match is recorded.',
  // Joins the two: {first} is a `nameCheck.record.*` sentence, {second} a `nameCheck.account.*` one
  'nameCheck.sentences': '{first} {second}',

  // Buttons under the paragraph; each opens a dialog that records the decision
  'nameCheck.action.match': 'Names match',
  'nameCheck.action.mismatch': 'Names do not match',
  // The second button once a match has been recorded
  'nameCheck.action.noLongerMatch': 'Names no longer match',

  // The dialog that records a match
  'nameCheck.matchDialog.title': 'Record that the names match?',
  'nameCheck.matchDialog.description':
    'Learners can pay this company once Stripe has enabled charges. The check is recorded under your name.',
  // Label of the company's legal name, under the Stripe account's (`stripe.account`)
  'nameCheck.matchDialog.company': 'Company',
  // Button
  'nameCheck.matchDialog.confirm': 'Record a match',

  // The dialog that records a mismatch
  'nameCheck.mismatchDialog.title': 'Record that the names do not match',
  'nameCheck.mismatchDialog.description':
    'The company cannot be paid until a match is recorded. Your note is emailed to the owner, so say what to change in Stripe.',
  // Label of the note field
  'nameCheck.mismatchDialog.note': 'What does not match (sent to the owner)',
  // Button
  'nameCheck.mismatchDialog.confirm': 'Record a mismatch',

  // Toasts once a decision is recorded: the title, then the description under it
  'nameCheck.toast.match': 'Match recorded',
  // The payout account is active now
  'nameCheck.toast.match.active': 'The company can now be paid.',
  // Stripe has not enabled charges yet
  'nameCheck.toast.match.waiting': 'The company can be paid as soon as Stripe enables charges.',
  'nameCheck.toast.mismatch': 'Mismatch recorded',
  'nameCheck.toast.mismatch.emailed': 'The owner has been emailed your note.',
  // Title of the toast when the decision could not be recorded; the description is the error itself
  'nameCheck.toast.failed': 'Could not record the check',
} as const
