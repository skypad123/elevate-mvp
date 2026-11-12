import { defineRelations } from 'drizzle-orm'
import { identities, magicLinks, sessions, userRoles, users } from './auth'
import { enrollments, payments, promoCodes, refunds } from './commerce'
import {
  artefacts,
  courseChangeSets,
  courses,
  lessonPrerequisites,
  lessons,
  quizzes,
} from './courses'
import { artefactProgress, certificates, quizAttempts } from './learning'
import { mediaAssets } from './media'
import {
  legalEntities,
  payoutAccounts,
  profileInvitations,
  profileMemberships,
  profiles,
} from './profiles'
import { analyticsEvents, auditLog, webhookEvents } from './system'

/**
 * Every table, keyed by the name services use in `db.query.<name>`. Listed here rather than taken
 * from `./index`, which re-exports this file.
 */
const tables = {
  users,
  identities,
  sessions,
  magicLinks,
  userRoles,
  profiles,
  legalEntities,
  payoutAccounts,
  profileMemberships,
  profileInvitations,
  mediaAssets,
  courses,
  courseChangeSets,
  lessons,
  lessonPrerequisites,
  artefacts,
  quizzes,
  promoCodes,
  enrollments,
  payments,
  refunds,
  artefactProgress,
  quizAttempts,
  certificates,
  webhookEvents,
  auditLog,
  analyticsEvents,
}

/**
 * Relations for `db.query`. Each one names its own columns (`from` → `to`), so two relations
 * between the same pair of tables never depend on a matching name. `optional: false` marks a
 * foreign key that is NOT NULL: the related row always exists, so its type has no `null`.
 */
export const relations = defineRelations(tables, (r) => ({
  users: {
    identities: r.many.identities({ from: r.users.id, to: r.identities.userId }),
    sessions: r.many.sessions({ from: r.users.id, to: r.sessions.userId }),
    roles: r.many.userRoles({ from: r.users.id, to: r.userRoles.userId }),
    ownedProfiles: r.many.profiles({ from: r.users.id, to: r.profiles.ownerUserId }),
    /** The profiles this user is a manager or writer of. */
    memberships: r.many.profileMemberships({
      from: r.users.id,
      to: r.profileMemberships.userId,
    }),
    enrollments: r.many.enrollments({ from: r.users.id, to: r.enrollments.userId }),
  },
  identities: {
    user: r.one.users({ from: r.identities.userId, to: r.users.id, optional: false }),
  },
  sessions: {
    user: r.one.users({ from: r.sessions.userId, to: r.users.id, optional: false }),
  },
  userRoles: {
    user: r.one.users({ from: r.userRoles.userId, to: r.users.id, optional: false }),
  },
  profiles: {
    owner: r.one.users({ from: r.profiles.ownerUserId, to: r.users.id, optional: false }),
    courses: r.many.courses({ from: r.profiles.id, to: r.courses.profileId }),
    /** At most one for now; a profile with none cannot be paid. */
    payoutAccount: r.one.payoutAccounts({ from: r.profiles.id, to: r.payoutAccounts.profileId }),
    avatar: r.one.mediaAssets({ from: r.profiles.avatarMediaId, to: r.mediaAssets.id }),
    teachingSample: r.one.mediaAssets({
      from: r.profiles.teachingSampleMediaId,
      to: r.mediaAssets.id,
    }),
    memberships: r.many.profileMemberships({
      from: r.profiles.id,
      to: r.profileMemberships.profileId,
    }),
    invitations: r.many.profileInvitations({
      from: r.profiles.id,
      to: r.profileInvitations.profileId,
    }),
    /** Corporate profiles only. */
    legalEntity: r.one.legalEntities({
      from: r.profiles.legalEntityId,
      to: r.legalEntities.id,
    }),
  },
  legalEntities: {
    profile: r.one.profiles({ from: r.legalEntities.id, to: r.profiles.legalEntityId }),
    registryDocument: r.one.mediaAssets({
      from: r.legalEntities.registryDocumentMediaId,
      to: r.mediaAssets.id,
    }),
    checker: r.one.users({ from: r.legalEntities.checkedBy, to: r.users.id }),
  },
  profileMemberships: {
    profile: r.one.profiles({
      from: r.profileMemberships.profileId,
      to: r.profiles.id,
      optional: false,
    }),
    user: r.one.users({ from: r.profileMemberships.userId, to: r.users.id, optional: false }),
    adder: r.one.users({ from: r.profileMemberships.addedBy, to: r.users.id }),
  },
  profileInvitations: {
    profile: r.one.profiles({
      from: r.profileInvitations.profileId,
      to: r.profiles.id,
      optional: false,
    }),
    inviter: r.one.users({ from: r.profileInvitations.invitedBy, to: r.users.id }),
    accepter: r.one.users({ from: r.profileInvitations.acceptedBy, to: r.users.id }),
  },
  payoutAccounts: {
    profile: r.one.profiles({
      from: r.payoutAccounts.profileId,
      to: r.profiles.id,
      optional: false,
    }),
    nameVerifier: r.one.users({ from: r.payoutAccounts.nameVerifiedBy, to: r.users.id }),
  },
  mediaAssets: {
    uploader: r.one.users({ from: r.mediaAssets.uploaderId, to: r.users.id }),
    profile: r.one.profiles({ from: r.mediaAssets.profileId, to: r.profiles.id }),
  },
  courses: {
    profile: r.one.profiles({ from: r.courses.profileId, to: r.profiles.id, optional: false }),
    thumbnail: r.one.mediaAssets({ from: r.courses.thumbnailMediaId, to: r.mediaAssets.id }),
    /** Live and draft rows alike: filter on `changeSetId` to pick one. */
    lessons: r.many.lessons({ from: r.courses.id, to: r.lessons.courseId }),
    changeSets: r.many.courseChangeSets({ from: r.courses.id, to: r.courseChangeSets.courseId }),
    enrollments: r.many.enrollments({ from: r.courses.id, to: r.enrollments.courseId }),
    payments: r.many.payments({ from: r.courses.id, to: r.payments.courseId }),
  },
  courseChangeSets: {
    course: r.one.courses({
      from: r.courseChangeSets.courseId,
      to: r.courses.id,
      optional: false,
    }),
    opener: r.one.users({ from: r.courseChangeSets.openedBy, to: r.users.id }),
  },
  lessons: {
    course: r.one.courses({ from: r.lessons.courseId, to: r.courses.id, optional: false }),
    artefacts: r.many.artefacts({ from: r.lessons.id, to: r.artefacts.lessonId }),
    /** The edges where this lesson is the one that has the prerequisite. */
    prerequisites: r.many.lessonPrerequisites({
      from: r.lessons.id,
      to: r.lessonPrerequisites.lessonId,
    }),
  },
  lessonPrerequisites: {
    lesson: r.one.lessons({
      from: r.lessonPrerequisites.lessonId,
      to: r.lessons.id,
      optional: false,
    }),
    prerequisite: r.one.lessons({
      from: r.lessonPrerequisites.prerequisiteLessonId,
      to: r.lessons.id,
      optional: false,
    }),
  },
  artefacts: {
    lesson: r.one.lessons({ from: r.artefacts.lessonId, to: r.lessons.id, optional: false }),
    media: r.one.mediaAssets({ from: r.artefacts.mediaAssetId, to: r.mediaAssets.id }),
    quiz: r.one.quizzes({ from: r.artefacts.id, to: r.quizzes.artefactId }),
  },
  quizzes: {
    artefact: r.one.artefacts({ from: r.quizzes.artefactId, to: r.artefacts.id, optional: false }),
    attempts: r.many.quizAttempts({ from: r.quizzes.id, to: r.quizAttempts.quizId }),
  },
  promoCodes: {
    course: r.one.courses({ from: r.promoCodes.courseId, to: r.courses.id }),
  },
  enrollments: {
    user: r.one.users({ from: r.enrollments.userId, to: r.users.id, optional: false }),
    course: r.one.courses({ from: r.enrollments.courseId, to: r.courses.id, optional: false }),
    promoCode: r.one.promoCodes({ from: r.enrollments.promoCodeId, to: r.promoCodes.id }),
    progress: r.many.artefactProgress({
      from: r.enrollments.id,
      to: r.artefactProgress.enrollmentId,
    }),
    attempts: r.many.quizAttempts({ from: r.enrollments.id, to: r.quizAttempts.enrollmentId }),
    payments: r.many.payments({ from: r.enrollments.id, to: r.payments.enrollmentId }),
    certificate: r.one.certificates({ from: r.enrollments.id, to: r.certificates.enrollmentId }),
  },
  payments: {
    enrollment: r.one.enrollments({
      from: r.payments.enrollmentId,
      to: r.enrollments.id,
      optional: false,
    }),
    course: r.one.courses({ from: r.payments.courseId, to: r.courses.id, optional: false }),
    user: r.one.users({ from: r.payments.userId, to: r.users.id, optional: false }),
    profile: r.one.profiles({ from: r.payments.profileId, to: r.profiles.id, optional: false }),
    payoutAccount: r.one.payoutAccounts({
      from: r.payments.payoutAccountId,
      to: r.payoutAccounts.id,
      optional: false,
    }),
    promoCode: r.one.promoCodes({ from: r.payments.promoCodeId, to: r.promoCodes.id }),
    refunds: r.many.refunds({ from: r.payments.id, to: r.refunds.paymentId }),
  },
  refunds: {
    payment: r.one.payments({ from: r.refunds.paymentId, to: r.payments.id, optional: false }),
  },
  artefactProgress: {
    enrollment: r.one.enrollments({
      from: r.artefactProgress.enrollmentId,
      to: r.enrollments.id,
      optional: false,
    }),
    artefact: r.one.artefacts({
      from: r.artefactProgress.artefactId,
      to: r.artefacts.id,
      optional: false,
    }),
  },
  quizAttempts: {
    enrollment: r.one.enrollments({
      from: r.quizAttempts.enrollmentId,
      to: r.enrollments.id,
      optional: false,
    }),
    quiz: r.one.quizzes({ from: r.quizAttempts.quizId, to: r.quizzes.id, optional: false }),
  },
  certificates: {
    enrollment: r.one.enrollments({
      from: r.certificates.enrollmentId,
      to: r.enrollments.id,
      optional: false,
    }),
  },
}))
