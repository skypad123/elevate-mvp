import { relations } from 'drizzle-orm'
import { identities, sessions, userRoles, users } from './auth'
import { enrollments, payments, promoCodes, refunds } from './commerce'
import { artefacts, courses, lessonPrerequisites, lessons, quizzes } from './courses'
import { artefactProgress, certificates, quizAttempts } from './learning'
import { mediaAssets } from './media'
import { teacherProfiles } from './teachers'

export const usersRelations = relations(users, ({ one, many }) => ({
  identities: many(identities),
  sessions: many(sessions),
  roles: many(userRoles, { relationName: 'userRoles' }),
  teacherProfile: one(teacherProfiles, {
    fields: [users.id],
    references: [teacherProfiles.userId],
  }),
  courses: many(courses),
  enrollments: many(enrollments),
}))

export const identitiesRelations = relations(identities, ({ one }) => ({
  user: one(users, { fields: [identities.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
    relationName: 'userRoles',
  }),
}))

export const teacherProfilesRelations = relations(teacherProfiles, ({ one }) => ({
  user: one(users, { fields: [teacherProfiles.userId], references: [users.id] }),
  teachingSample: one(mediaAssets, {
    fields: [teacherProfiles.teachingSampleMediaId],
    references: [mediaAssets.id],
  }),
}))

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  owner: one(users, { fields: [mediaAssets.ownerId], references: [users.id] }),
}))

export const coursesRelations = relations(courses, ({ one, many }) => ({
  teacher: one(users, { fields: [courses.teacherId], references: [users.id] }),
  thumbnail: one(mediaAssets, { fields: [courses.thumbnailMediaId], references: [mediaAssets.id] }),
  lessons: many(lessons),
  enrollments: many(enrollments),
  payments: many(payments),
}))

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, { fields: [lessons.courseId], references: [courses.id] }),
  artefacts: many(artefacts),
  prerequisites: many(lessonPrerequisites, { relationName: 'lessonPrerequisites' }),
}))

export const lessonPrerequisitesRelations = relations(lessonPrerequisites, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonPrerequisites.lessonId],
    references: [lessons.id],
    relationName: 'lessonPrerequisites',
  }),
  prerequisite: one(lessons, {
    fields: [lessonPrerequisites.prerequisiteLessonId],
    references: [lessons.id],
    relationName: 'prerequisiteOf',
  }),
}))

export const artefactsRelations = relations(artefacts, ({ one }) => ({
  lesson: one(lessons, { fields: [artefacts.lessonId], references: [lessons.id] }),
  media: one(mediaAssets, { fields: [artefacts.mediaAssetId], references: [mediaAssets.id] }),
  quiz: one(quizzes, { fields: [artefacts.id], references: [quizzes.artefactId] }),
}))

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  artefact: one(artefacts, { fields: [quizzes.artefactId], references: [artefacts.id] }),
  attempts: many(quizAttempts),
}))

export const promoCodesRelations = relations(promoCodes, ({ one }) => ({
  course: one(courses, { fields: [promoCodes.courseId], references: [courses.id] }),
}))

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
  promoCode: one(promoCodes, { fields: [enrollments.promoCodeId], references: [promoCodes.id] }),
  progress: many(artefactProgress),
  attempts: many(quizAttempts),
  payments: many(payments),
  certificate: one(certificates, {
    fields: [enrollments.id],
    references: [certificates.enrollmentId],
  }),
}))

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  enrollment: one(enrollments, { fields: [payments.enrollmentId], references: [enrollments.id] }),
  course: one(courses, { fields: [payments.courseId], references: [courses.id] }),
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  refunds: many(refunds),
}))

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, { fields: [refunds.paymentId], references: [payments.id] }),
}))

export const artefactProgressRelations = relations(artefactProgress, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [artefactProgress.enrollmentId],
    references: [enrollments.id],
  }),
  artefact: one(artefacts, { fields: [artefactProgress.artefactId], references: [artefacts.id] }),
}))

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [quizAttempts.enrollmentId],
    references: [enrollments.id],
  }),
  quiz: one(quizzes, { fields: [quizAttempts.quizId], references: [quizzes.id] }),
}))

export const certificatesRelations = relations(certificates, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [certificates.enrollmentId],
    references: [enrollments.id],
  }),
}))
