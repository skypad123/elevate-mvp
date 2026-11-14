import { defineRelations } from 'drizzle-orm'
import { userRoles, users } from './schema/auth'
import { enrollments } from './schema/commerce'
import {
  courses,
  liveArtefacts,
  liveLessonPrerequisites,
  liveLessons,
  liveQuizzes,
} from './schema/courses'
import { artefactProgress, certificates, quizAttempts } from './schema/learning'
import { mediaAssets } from './schema/media'
import { profiles } from './schema/profiles'

/**
 * The relations learner-facing code reads through. Course content is reachable only by the four
 * views (`live_lessons`, `live_artefacts`, `live_quizzes`, `live_lesson_prerequisites`), which
 * leave out a writer's draft rows, so a client built from this set cannot return a draft.
 *
 * The content keys are named `live…` on purpose: they differ from the raw relations' keys
 * (`lessons`, `artefacts`, `quiz`, `prerequisites`), which is how `schema-guard.test.ts` tells a
 * learner read from a raw one.
 */
const tables = {
  users,
  userRoles,
  profiles,
  mediaAssets,
  courses,
  liveLessons,
  liveArtefacts,
  liveQuizzes,
  liveLessonPrerequisites,
  enrollments,
  artefactProgress,
  quizAttempts,
  certificates,
}

export const learnerRelations = defineRelations(tables, (r) => ({
  users: {
    roles: r.many.userRoles({ from: r.users.id, to: r.userRoles.userId }),
  },
  profiles: {
    owner: r.one.users({ from: r.profiles.ownerUserId, to: r.users.id, optional: false }),
    avatar: r.one.mediaAssets({ from: r.profiles.avatarMediaId, to: r.mediaAssets.id }),
  },
  courses: {
    profile: r.one.profiles({ from: r.courses.profileId, to: r.profiles.id, optional: false }),
    thumbnail: r.one.mediaAssets({ from: r.courses.thumbnailMediaId, to: r.mediaAssets.id }),
    liveLessons: r.many.liveLessons({ from: r.courses.id, to: r.liveLessons.courseId }),
  },
  liveLessons: {
    liveArtefacts: r.many.liveArtefacts({ from: r.liveLessons.id, to: r.liveArtefacts.lessonId }),
    /** The edges where this lesson is the one that has the prerequisite. */
    livePrerequisites: r.many.liveLessonPrerequisites({
      from: r.liveLessons.id,
      to: r.liveLessonPrerequisites.lessonId,
    }),
  },
  liveArtefacts: {
    media: r.one.mediaAssets({ from: r.liveArtefacts.mediaAssetId, to: r.mediaAssets.id }),
    liveQuiz: r.one.liveQuizzes({ from: r.liveArtefacts.id, to: r.liveQuizzes.artefactId }),
  },
  enrollments: {
    user: r.one.users({ from: r.enrollments.userId, to: r.users.id, optional: false }),
    course: r.one.courses({ from: r.enrollments.courseId, to: r.courses.id, optional: false }),
    progress: r.many.artefactProgress({
      from: r.enrollments.id,
      to: r.artefactProgress.enrollmentId,
    }),
    attempts: r.many.quizAttempts({ from: r.enrollments.id, to: r.quizAttempts.enrollmentId }),
    certificate: r.one.certificates({ from: r.enrollments.id, to: r.certificates.enrollmentId }),
  },
}))
