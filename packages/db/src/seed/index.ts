import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { quizDefinitionSchema } from '@elevate/core'
import { and, eq } from 'drizzle-orm'
import type { AnyDb } from '../index'

import * as s from '../schema'
import { type SeedCourse, type SeedTeacher, seedCourses, seedTeachers } from './content'

export type SeedOptions = {
  superAdminEmail: string
  /** Where local storage lives; thumbnails are written under <dir>/public/seed. Null skips images. */
  storageDir: string | null
  log?: (message: string) => void
}

function thumbnailSvg(course: SeedCourse): string {
  const words = course.title.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if (`${current} ${w}`.trim().length > 22) {
      lines.push(current.trim())
      current = w
    } else current = `${current} ${w}`
  }
  if (current.trim()) lines.push(current.trim())
  const text = lines
    .slice(0, 3)
    .map(
      (l, i) =>
        `<text x="48" y="${150 + i * 44}" font-size="34" font-family="Georgia, serif" font-weight="600" fill="#FAF7F1">${l.replace(/&/g, '&amp;')}</text>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${course.accent}"/><stop offset="1" stop-color="#1A1C1A"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="660" cy="120" r="160" fill="#FAF7F1" fill-opacity="0.08"/><path d="M48 520 L200 400 L320 470 L520 300 L752 380" fill="none" stroke="#FAF7F1" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${text}</svg>`
}

async function upsertUser(db: AnyDb, email: string, name: string) {
  const [user] = await db
    .insert(s.users)
    .values({ email, name })
    .onConflictDoUpdate({ target: s.users.email, set: { name } })
    .returning()
  if (!user) throw new Error(`failed to upsert user ${email}`)
  await db
    .insert(s.identities)
    .values({ userId: user.id, provider: 'email', providerSubject: email.toLowerCase() })
    .onConflictDoNothing()
  return user
}

async function grantRole(
  db: AnyDb,
  userId: string,
  role: 'teacher' | 'support_agent' | 'super_admin',
) {
  await db.insert(s.userRoles).values({ userId, role }).onConflictDoNothing()
}

async function upsertTeacher(db: AnyDb, t: SeedTeacher) {
  const user = await upsertUser(db, t.email, t.name)
  await grantRole(db, user.id, 'teacher')
  await db
    .insert(s.teacherProfiles)
    .values({
      userId: user.id,
      displayName: t.displayName,
      headline: t.headline,
      bio: t.bio,
      credentials: t.credentials,
      teachingSampleUrl: 'https://example.com/teaching-sample',
      status: 'approved',
      commissionBps: t.commissionBps,
      reviewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: s.teacherProfiles.userId,
      set: {
        displayName: t.displayName,
        headline: t.headline,
        bio: t.bio,
        credentials: t.credentials,
      },
    })
  return user
}

async function ensureThumbnail(
  db: AnyDb,
  ownerId: string,
  course: SeedCourse,
  storageDir: string | null,
) {
  const storageKey = `public/seed/${course.slug}.svg`
  if (storageDir) {
    const file = join(storageDir, storageKey)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, thumbnailSvg(course))
  }
  const existing = await db.query.mediaAssets.findFirst({
    where: eq(s.mediaAssets.storageKey, storageKey),
  })
  if (existing) return existing.id
  const [asset] = await db
    .insert(s.mediaAssets)
    .values({
      ownerId,
      kind: 'image',
      provider: 'local',
      status: 'ready',
      storageKey,
      filename: `${course.slug}.svg`,
      mimeType: 'image/svg+xml',
      width: 800,
      height: 600,
    })
    .returning()
  return asset?.id ?? null
}

async function seedCourse(
  db: AnyDb,
  course: SeedCourse,
  teacherId: string,
  storageDir: string | null,
) {
  const thumbnailMediaId = await ensureThumbnail(db, teacherId, course, storageDir)
  const existing = await db.query.courses.findFirst({ where: eq(s.courses.slug, course.slug) })
  const now = new Date()
  const statusFields =
    course.status === 'live'
      ? { submittedAt: now, reviewedAt: now, publishedAt: now }
      : course.status === 'pending_review'
        ? { submittedAt: now }
        : {}
  const descriptionJson = {
    type: 'doc' as const,
    content: course.description
      .split('\n\n')
      .map((p) => ({ type: 'paragraph' as const, content: [{ type: 'text' as const, text: p }] })),
  }

  if (existing) {
    await db
      .update(s.courses)
      .set({
        title: course.title,
        summary: course.summary,
        category: course.category,
        priceCents: course.priceCents,
        thumbnailMediaId,
        descriptionJson,
      })
      .where(eq(s.courses.id, existing.id))
    return existing.id
  }

  const [created] = await db
    .insert(s.courses)
    .values({
      teacherId,
      title: course.title,
      slug: course.slug,
      summary: course.summary,
      descriptionJson,
      category: course.category,
      thumbnailMediaId,
      priceCents: course.priceCents,
      status: course.status,
      ...statusFields,
    })
    .returning()
  if (!created) throw new Error(`failed to create course ${course.slug}`)

  const lessonIds = new Map<string, string>()
  for (const [index, lesson] of course.lessons.entries()) {
    const [l] = await db
      .insert(s.lessons)
      .values({
        courseId: created.id,
        title: lesson.title,
        summary: lesson.summary,
        position: index,
      })
      .returning()
    if (!l) throw new Error('failed to create lesson')
    lessonIds.set(lesson.key, l.id)
    for (const [aIndex, artefact] of lesson.artefacts.entries()) {
      if (artefact.type === 'text') {
        await db.insert(s.artefacts).values({
          lessonId: l.id,
          type: 'text',
          title: artefact.title,
          position: aIndex,
          contentJson: artefact.content,
          durationSeconds: (artefact.minutes ?? 3) * 60,
        })
      } else {
        const [a] = await db
          .insert(s.artefacts)
          .values({
            lessonId: l.id,
            type: 'quiz',
            title: artefact.title,
            position: aIndex,
            durationSeconds: 5 * 60,
          })
          .returning()
        if (!a) throw new Error('failed to create quiz artefact')
        const quiz = quizDefinitionSchema.parse(artefact.quiz)
        await db.insert(s.quizzes).values({
          artefactId: a.id,
          passMarkPercent: quiz.passMarkPercent,
          maxAttempts: quiz.maxAttempts,
          timeLimitMinutes: quiz.timeLimitMinutes,
          questionsJson: quiz.questions,
        })
      }
    }
  }
  for (const lesson of course.lessons) {
    for (const prereqKey of lesson.prerequisites ?? []) {
      const lessonId = lessonIds.get(lesson.key)
      const prerequisiteLessonId = lessonIds.get(prereqKey)
      if (lessonId && prerequisiteLessonId) {
        await db
          .insert(s.lessonPrerequisites)
          .values({ lessonId, prerequisiteLessonId })
          .onConflictDoNothing()
      }
    }
  }
  return created.id
}

export async function seedDatabase(db: AnyDb, options: SeedOptions) {
  const log = options.log ?? (() => {})

  const admin = await upsertUser(db, options.superAdminEmail, 'Elevate Admin')
  await grantRole(db, admin.id, 'super_admin')
  log(`super admin: ${options.superAdminEmail}`)

  const agent = await upsertUser(db, 'support@example.com', 'Sam Support')
  await grantRole(db, agent.id, 'support_agent')

  const teacherIds = new Map<string, string>()
  for (const t of seedTeachers) {
    const user = await upsertTeacher(db, t)
    teacherIds.set(t.email, user.id)
  }
  log(`${seedTeachers.length} teachers`)

  const courseIds = new Map<string, string>()
  for (const course of seedCourses) {
    const teacherId = teacherIds.get(course.teacherEmail)
    if (!teacherId) throw new Error(`unknown teacher ${course.teacherEmail}`)
    courseIds.set(course.slug, await seedCourse(db, course, teacherId, options.storageDir))
  }
  log(`${seedCourses.length} courses`)

  const ceramicsId = courseIds.get('wheel-thrown-ceramics-for-beginners') ?? null
  const promos = [
    {
      code: 'WELCOME10',
      type: 'percent' as const,
      value: 10,
      courseId: null,
      maxRedemptions: null,
    },
    {
      code: 'CERAMICS20',
      type: 'fixed' as const,
      value: 2000,
      courseId: ceramicsId,
      maxRedemptions: 50,
    },
  ]
  for (const promo of promos) {
    await db
      .insert(s.promoCodes)
      .values({ ...promo, createdBy: admin.id })
      .onConflictDoUpdate({ target: s.promoCodes.code, set: { value: promo.value, active: true } })
  }
  log(`${promos.length} promo codes`)

  // A learner part-way through Sourdough so My Learning has something to show.
  const learner = await upsertUser(db, 'learner@example.com', 'Alex Learner')
  const sourdoughId = courseIds.get('sourdough-from-scratch')
  if (sourdoughId) {
    const existing = await db.query.enrollments.findFirst({
      where: and(eq(s.enrollments.userId, learner.id), eq(s.enrollments.courseId, sourdoughId)),
    })
    if (!existing) {
      const [enrollment] = await db
        .insert(s.enrollments)
        .values({
          userId: learner.id,
          courseId: sourdoughId,
          status: 'active',
          enrolledAt: new Date(),
        })
        .returning()
      const firstLesson = await db.query.lessons.findFirst({
        where: eq(s.lessons.courseId, sourdoughId),
        orderBy: (l, { asc }) => [asc(l.position)],
        with: { artefacts: { orderBy: (a, { asc }) => [asc(a.position)] } },
      })
      const firstText = firstLesson?.artefacts.find((a) => a.type === 'text')
      if (enrollment && firstText) {
        await db.insert(s.artefactProgress).values({
          enrollmentId: enrollment.id,
          artefactId: firstText.id,
          status: 'completed',
          completedAt: new Date(),
        })
        await db.update(s.courses).set({ enrolCount: 1 }).where(eq(s.courses.id, sourdoughId))
      }
    }
  }
  log('demo learner enrolled in Sourdough from Scratch')

  return { adminId: admin.id, teacherIds, courseIds }
}
