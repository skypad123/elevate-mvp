/**
 * Who may do what on a teaching profile. Pure rules, shared by the API (which enforces them) and
 * the Teach portal (which hides what the API would refuse).
 *
 * A request is first resolved to an actor: the profile's owner, a member with a role, or platform
 * staff. Every guarded Teach action then asks `can(actor, capability)`.
 */

export const CAPABILITIES = [
  'profile.read',
  'profile.edit',
  'course.create',
  'course.editDraft',
  'course.editLive',
  'course.proposeLiveEdit',
  'course.setPrice',
  'course.submit',
  'course.delete',
  'changeSet.review',
  'media.upload',
  'earnings.read',
  'members.read',
  'members.manageWriters',
  'members.manageManagers',
  'stripe.links',
] as const
export type Capability = (typeof CAPABILITIES)[number]

export type ProfileType = 'personal' | 'corporate'
export type ProfileStatus = 'applied' | 'approved' | 'rejected'

/** `staff` is a `super_admin` acting inside Teach; it is never stored on a profile. */
export type ActorRole = 'owner' | 'manager' | 'writer' | 'staff'
/** The roles a user can hold on a profile. */
export type ProfileRole = Exclude<ActorRole, 'staff'>

export type Actor = {
  role: ActorRole
  profileType: ProfileType
  profileStatus: ProfileStatus
}

const ALL: readonly Capability[] = CAPABILITIES

/** Everything except the two things only an owner does: Stripe links and choosing managers. */
const MANAGER: readonly Capability[] = ALL.filter(
  (capability) => capability !== 'stripe.links' && capability !== 'members.manageManagers',
)

const WRITER: readonly Capability[] = [
  'profile.read',
  'course.create',
  'course.editDraft',
  'course.proposeLiveEdit',
  'media.upload',
]

/**
 * Staff fix content and can read the profile, its members and its earnings. Money, publishing and
 * membership stay with the teacher.
 */
const STAFF: readonly Capability[] = [
  'profile.read',
  'profile.edit',
  'course.editDraft',
  'course.editLive',
  'media.upload',
  'earnings.read',
  'members.read',
]

const NONE: readonly Capability[] = []

const TABLE: Record<ActorRole, Record<ProfileType, ReadonlySet<Capability>>> = {
  owner: { personal: new Set(ALL), corporate: new Set(ALL) },
  // Managers exist only on corporate profiles.
  manager: { personal: new Set(NONE), corporate: new Set(MANAGER) },
  writer: { personal: new Set(WRITER), corporate: new Set(WRITER) },
  staff: { personal: new Set(STAFF), corporate: new Set(STAFF) },
}

/** All that the owner and members of a profile get until Support approves it. */
const UNAPPROVED: ReadonlySet<Capability> = new Set<Capability>(['profile.read', 'profile.edit'])

export function can(actor: Actor, capability: Capability): boolean {
  if (actor.profileStatus !== 'approved' && actor.role !== 'staff') {
    return UNAPPROVED.has(capability)
  }
  return TABLE[actor.role][actor.profileType].has(capability)
}
