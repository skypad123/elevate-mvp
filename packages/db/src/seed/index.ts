import { quizDefinitionSchema } from '@elevate/core'
import { eq } from 'drizzle-orm'
import type { AnyDb } from '../index'

import * as s from '../schema'
import { type SeedCourse, type SeedTeacher, seedCourses, seedTeachers } from './content'

/** Where the seed writes course thumbnails. `put` has the signature of the API's storage provider. */
export type SeedStorage = {
  /** Recorded on the seeded media rows, so the API reads the files from the right place. */
  provider: 'local' | 's3'
  put(key: string, body: Uint8Array, mimeType: string): Promise<void>
}

export type SeedOptions = {
  superAdminEmail: string
  /**
   * `admin-only` creates the super admin and nothing else. `demo` also creates a support agent,
   * the demo teachers (as approved personal profiles with no payout account, so their courses
   * cannot be bought), a writer on the first of those profiles, an approved company profile with
   * a manager, the demo courses, two promo codes and a learner.
   */
  mode: 'demo' | 'admin-only'
  /** Null skips the thumbnail files; the media rows are still created. */
  storage: SeedStorage | null
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

async function grantRole(db: AnyDb, userId: string, role: 'support_agent' | 'super_admin') {
  await db.insert(s.userRoles).values({ userId, role }).onConflictDoNothing()
}

/** The teacher's user and their approved personal profile. Re-seeding refreshes the profile text. */
async function upsertTeacher(db: AnyDb, t: SeedTeacher) {
  const user = await upsertUser(db, t.email, t.name)
  const details = {
    displayName: t.displayName,
    headline: t.headline,
    bio: t.bio,
    credentials: t.credentials,
  }
  const existing = await db.query.profiles.findFirst({
    where: { ownerUserId: user.id, type: 'personal' },
  })
  if (existing) {
    await db.update(s.profiles).set(details).where(eq(s.profiles.id, existing.id))
    return { userId: user.id, profileId: existing.id }
  }
  const [profile] = await db
    .insert(s.profiles)
    .values({
      type: 'personal',
      ownerUserId: user.id,
      ...details,
      teachingSampleUrl: 'https://example.com/teaching-sample',
      status: 'approved',
      commissionBps: t.commissionBps,
      reviewedAt: new Date(),
    })
    .returning()
  if (!profile) throw new Error(`failed to create a profile for ${t.email}`)
  return { userId: user.id, profileId: profile.id }
}

/** The demo company: made up, with a UEN that has the right format and belongs to no one. */
const DEMO_COMPANY = {
  uen: '201912345K',
  legalName: 'Kiln & Co Studio Pte. Ltd.',
  displayName: 'Kiln & Co Studio',
  headline: 'Studio ceramics classes, taught by a team of working potters',
  bio: 'Kiln & Co is a teaching studio. Its potters run beginner and intermediate classes in wheel throwing, glazing and firing, and build their courses together.',
  credentials:
    'A registered studio since 2019. Four resident potters, each with more than five years of teaching.',
  owner: { email: 'founder@example.com', name: 'Farah Founder' },
  manager: { email: 'manager@example.com', name: 'Maya Manager' },
}

/**
 * An approved corporate profile whose company Support has already verified, with one manager and
 * no payout account. So it can be shown without a real company, and checkout never sends Stripe
 * a made-up destination. Re-seeding refreshes its text.
 */
async function upsertDemoCompany(db: AnyDb, adminId: string): Promise<string> {
  const owner = await upsertUser(db, DEMO_COMPANY.owner.email, DEMO_COMPANY.owner.name)
  const manager = await upsertUser(db, DEMO_COMPANY.manager.email, DEMO_COMPANY.manager.name)
  const details = {
    displayName: DEMO_COMPANY.displayName,
    headline: DEMO_COMPANY.headline,
    bio: DEMO_COMPANY.bio,
    credentials: DEMO_COMPANY.credentials,
  }
  const now = new Date()
  let entity = await db.query.legalEntities.findFirst({ where: { uen: DEMO_COMPANY.uen } })
  if (!entity) {
    const [created] = await db
      .insert(s.legalEntities)
      .values({
        uen: DEMO_COMPANY.uen,
        legalName: DEMO_COMPANY.legalName,
        entityType: 'private_limited',
        checkStatus: 'verified',
        checkedBy: adminId,
        checkedAt: now,
      })
      .returning()
    if (!created) throw new Error('failed to create the demo company')
    entity = created
  }
  let profile = await db.query.profiles.findFirst({ where: { legalEntityId: entity.id } })
  if (profile) {
    await db.update(s.profiles).set(details).where(eq(s.profiles.id, profile.id))
  } else {
    const [created] = await db
      .insert(s.profiles)
      .values({
        type: 'corporate',
        ownerUserId: owner.id,
        legalEntityId: entity.id,
        ...details,
        teachingSampleUrl: 'https://example.com/teaching-sample',
        status: 'approved',
        reviewedAt: now,
        reviewedBy: adminId,
      })
      .returning()
    if (!created) throw new Error('failed to create the demo company profile')
    profile = created
  }
  await db
    .insert(s.profileMemberships)
    .values({ profileId: profile.id, userId: manager.id, role: 'manager', addedBy: owner.id })
    .onConflictDoNothing()
  return profile.id
}

async function ensureThumbnail(
  db: AnyDb,
  owner: { userId: string; profileId: string },
  course: SeedCourse,
  storage: SeedStorage | null,
) {
  const storageKey = `public/seed/${course.slug}.svg`
  if (storage) {
    await storage.put(storageKey, Buffer.from(thumbnailSvg(course)), 'image/svg+xml')
  }
  const existing = await db.query.mediaAssets.findFirst({ where: { storageKey } })
  if (existing) return existing.id
  const [asset] = await db
    .insert(s.mediaAssets)
    .values({
      uploaderId: owner.userId,
      profileId: owner.profileId,
      kind: 'image',
      provider: storage?.provider ?? 'local',
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
  owner: { userId: string; profileId: string },
  storage: SeedStorage | null,
) {
  const thumbnailMediaId = await ensureThumbnail(db, owner, course, storage)
  const existing = await db.query.courses.findFirst({ where: { slug: course.slug } })
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
      profileId: owner.profileId,
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

  /** Owner email → their personal profile. */
  const profileIds = new Map<string, string>()
  const courseIds = new Map<string, string>()
  if (options.mode === 'admin-only') return { adminId: admin.id, profileIds, courseIds }

  const agent = await upsertUser(db, 'support@example.com', 'Sam Support')
  await grantRole(db, agent.id, 'support_agent')

  const owners = new Map<string, { userId: string; profileId: string }>()
  for (const t of seedTeachers) {
    const owner = await upsertTeacher(db, t)
    owners.set(t.email, owner)
    profileIds.set(t.email, owner.profileId)
  }
  log(`${seedTeachers.length} teacher profiles (no payout accounts: demo courses cannot be bought)`)

  // A writer on the first profile, so there is someone to try member and change-set flows with.
  const firstTeacher = seedTeachers[0]
  const firstOwner = firstTeacher ? owners.get(firstTeacher.email) : undefined
  if (firstTeacher && firstOwner) {
    const writer = await upsertUser(db, 'writer@example.com', 'Wei Writer')
    await db
      .insert(s.profileMemberships)
      .values({
        profileId: firstOwner.profileId,
        userId: writer.id,
        role: 'writer',
        addedBy: firstOwner.userId,
      })
      .onConflictDoNothing()
    log(`writer@example.com is a writer on ${firstTeacher.displayName}`)
  }

  await upsertDemoCompany(db, admin.id)
  log(
    `${DEMO_COMPANY.displayName}: a company profile owned by ${DEMO_COMPANY.owner.email}, with ${DEMO_COMPANY.manager.email} as a manager`,
  )

  for (const course of seedCourses) {
    const owner = owners.get(course.teacherEmail)
    if (!owner) throw new Error(`unknown teacher ${course.teacherEmail}`)
    courseIds.set(course.slug, await seedCourse(db, course, owner, options.storage))
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
      where: { userId: learner.id, courseId: sourdoughId },
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
        where: { courseId: sourdoughId, changeSetId: { isNull: true } },
        orderBy: { position: 'asc' },
        with: { artefacts: { orderBy: { position: 'asc' } } },
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

  return { adminId: admin.id, profileIds, courseIds }
}
