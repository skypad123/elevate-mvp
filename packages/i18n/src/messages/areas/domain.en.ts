/**
 * The vocabulary of teaching profiles, shared by Teach and Support. A segment that is looked up by
 * an enum value is that value as it is stored, so ``t(`status.course.${course.status}`)`` is
 * checked against the enum.
 */
export const domainEn = {
  // A person's role on a teaching profile. Platform roles (staff) are `role.*`.
  'profileRole.owner': 'Owner',
  'profileRole.manager': 'Manager',
  'profileRole.writer': 'Writer',
  'profileRole.owner.summary': 'Everything, including payout settings and who the managers are.',
  'profileRole.manager.summary':
    'Runs the profile with the owner: courses, prices, publishing, writers and earnings. Payout settings and managers stay with the owner.',
  'profileRole.writer.summary':
    'Creates and edits course content. Cannot change prices, publish courses or see earnings. Edits to a live course wait for approval.',
  // A role and what it can do, with the role in bold: fill both slots with `fillSlots`.
  'profileRole.note': '{role}. {summary}',

  'profileType.personal': 'Personal',
  'profileType.corporate': 'Corporate',

  'status.profile.applied': 'Applied',
  'status.profile.approved': 'Approved',
  'status.profile.rejected': 'Rejected',
  'status.course.draft': 'Draft',
  'status.course.pending_review': 'Pending review',
  'status.course.live': 'Live',
  'status.course.rejected': 'Rejected',
  'status.payout.onboarding': 'Onboarding',
  'status.payout.active': 'Active',

  // A company
  'entityType.private_limited': 'Private limited company (Pte. Ltd.)',
  'entityType.llp': 'Limited liability partnership (LLP)',
  'company.legalName': 'Legal name',
  'company.legalForm': 'Legal form',
  'company.uen': 'UEN',
  'company.uenValue': 'UEN {uen}',

  // What a profile shows learners
  'profileField.displayName': 'Display name',
  'profileField.headline': 'Headline',
  'profileField.bio': 'Bio',

  'stripe.account': 'Stripe account',
  'stripe.connect': 'Connect Stripe',
  'stripe.openDashboard': 'Open Stripe dashboard',
} as const
