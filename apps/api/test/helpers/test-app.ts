import type { Locale } from '@elevate/core'
import { codePeriod } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { createPgliteDb } from '@elevate/db/pglite'
import { eq } from 'drizzle-orm'
import { createApp } from '../../src/app'
import type { Deps } from '../../src/deps'
import { loadEnv } from '../../src/env'
import { codesFor, newBlockSecret } from '../../src/lib/class-code'
import { silentLogger } from '../../src/lib/logger'
import { FakeMailer } from '../../src/providers/mailer'
import { FakePaymentsProvider, type PaymentsWebhookEvent } from '../../src/providers/payments'
import { FakeStorage } from '../../src/providers/storage'
import { FakeVideoProvider } from '../../src/providers/video'

export type ApiResponse<T = unknown> = { status: number; body: T; res: Response }

export async function createTestApp(overrides: Record<string, string> = {}) {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'pglite://memory',
    SESSION_SECRET: 'test-secret-test-secret-test-secret',
    DEV_ENDPOINTS_ENABLED: 'true',
    API_URL: 'http://api.test',
    LEARNER_URL: 'http://learner.test',
    TEACH_URL: 'http://teach.test',
    SUPPORT_URL: 'http://support.test',
    CLASSES: 'true',
    ...overrides,
  })
  // The whole suite runs as the API's restricted database user, so a missing grant fails a test.
  const { db, learnerDb, client } = await createPgliteDb({ apiRole: 'elevate_api' })
  const mailer = new FakeMailer()
  const storage = new FakeStorage(env.API_URL)
  const video = new FakeVideoProvider()
  const payments = new FakePaymentsProvider()
  let clock = new Date('2026-11-08T04:00:00.000Z')
  const deps: Deps = {
    env,
    db,
    learnerDb,
    mailer,
    storage,
    video,
    payments,
    log: silentLogger,
    now: () => clock,
  }
  const app = createApp(deps)

  // biome-ignore lint/suspicious/noExplicitAny: test helper returns loosely typed JSON on purpose
  async function api<T = any>(
    method: string,
    path: string,
    options: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { ...options.headers }
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    if (options.token) headers.authorization = `Bearer ${options.token}`
    const res = await app.request(path, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
    const text = await res.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { status: res.status, body: body as T, res }
  }

  /** Signs in by code. `opts` is the device's language, sent as the learner app sends it. */
  async function signIn(
    email: string,
    audience: 'learner' | 'teach' | 'support' = 'learner',
    opts: { locale?: Locale; localeChosen?: boolean } = {},
  ) {
    const requested = await api('POST', '/api/auth/magic-link', {
      body: { email, audience, locale: opts.locale },
    })
    if (requested.status !== 200)
      throw new Error(`magic link request failed: ${JSON.stringify(requested.body)}`)
    const code = requested.body.dev.code as string
    const verified = await api('POST', '/api/auth/verify', {
      body: { email, code, locale: opts.locale, localeChosen: opts.localeChosen },
    })
    return {
      status: verified.status,
      body: verified.body,
      token: verified.body?.token as string | undefined,
    }
  }

  async function ensureUser(email: string, name?: string) {
    const existing = await db.query.users.findFirst({ where: { email } })
    if (existing) return existing
    const [created] = await db
      .insert(s.users)
      .values({ email, name: name ?? null })
      .returning()
    if (!created) throw new Error('failed to create user')
    return created
  }

  async function grantRole(email: string, role: 'support_agent' | 'super_admin') {
    const user = await ensureUser(email)
    await db.insert(s.userRoles).values({ userId: user.id, role }).onConflictDoNothing()
    return user
  }

  /**
   * Gives a profile an active payout account on the fake Stripe, with charges enabled: the state
   * a profile reaches after onboarding. Returns the payout account row.
   */
  async function makePayable(profileId: string) {
    const profile = await db.query.profiles.findFirst({
      where: { id: profileId },
      with: { owner: true },
    })
    if (!profile) throw new Error(`no profile ${profileId}`)
    const [account] = await db
      .insert(s.payoutAccounts)
      .values({ profileId, businessType: profile.type === 'corporate' ? 'company' : 'individual' })
      .returning()
    if (!account) throw new Error('failed to create payout account')
    const { accountId } = await payments.createConnectedAccount({
      businessType: account.businessType,
      profileId,
      payoutAccountId: account.id,
      email: profile.owner.email,
      displayName: profile.displayName,
    })
    payments.enableAccount(accountId)
    const [active] = await db
      .update(s.payoutAccounts)
      .set({
        stripeAccountId: accountId,
        status: 'active',
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        activatedAt: clock,
        // A company account is active only once Support has matched its legal name.
        nameVerifiedAt: account.businessType === 'company' ? clock : null,
      })
      .where(eq(s.payoutAccounts.id, account.id))
      .returning()
    if (!active) throw new Error('failed to activate payout account')
    return active
  }

  /**
   * A profile owned by `email`, written straight to the database (approved and personal unless
   * told otherwise). `payable` also gives it an active payout account.
   */
  async function createProfile(
    email: string,
    options: {
      displayName?: string
      type?: 'personal' | 'corporate'
      status?: 'applied' | 'approved' | 'rejected'
      payable?: boolean
    } = {},
  ) {
    const user = await ensureUser(email)
    const status = options.status ?? 'approved'
    const type = options.type ?? 'personal'
    const displayName = options.displayName ?? 'Test Teacher'
    // A corporate profile is a registered company: it comes with its legal entity, in the state
    // Support's review would have left it in.
    let legalEntityId: string | null = null
    if (type === 'corporate') {
      const [entity] = await db
        .insert(s.legalEntities)
        .values({
          uen: `2019${String(++companyCounter).padStart(5, '0')}K`,
          legalName: `${displayName} Pte. Ltd.`,
          entityType: 'private_limited',
          checkStatus:
            status === 'approved' ? 'verified' : status === 'rejected' ? 'rejected' : 'pending',
          checkedAt: status === 'applied' ? null : clock,
        })
        .returning()
      if (!entity) throw new Error('failed to create legal entity')
      legalEntityId = entity.id
    }
    const [profile] = await db
      .insert(s.profiles)
      .values({
        type,
        ownerUserId: user.id,
        displayName,
        legalEntityId,
        status,
        reviewedAt: status === 'applied' ? null : clock,
      })
      .returning()
    if (!profile) throw new Error('failed to create profile')
    const payoutAccount = options.payable ? await makePayable(profile.id) : null
    return { user, profile, payoutAccount }
  }

  /** Makes `email` a manager or writer of a profile, written straight to the database. */
  async function addMember(profileId: string, email: string, role: 'manager' | 'writer') {
    const user = await ensureUser(email)
    await db.insert(s.profileMemberships).values({ profileId, userId: user.id, role })
    return user
  }

  /** An active enrolment for `email` in a course, written straight to the database. */
  async function enrol(email: string, courseId: string) {
    const user = await ensureUser(email)
    const [enrollment] = await db
      .insert(s.enrollments)
      .values({ userId: user.id, courseId, status: 'active', enrolledAt: clock })
      .returning()
    if (!enrollment) throw new Error('failed to enrol')
    return enrollment
  }

  let courseCounter = 0
  let companyCounter = 0
  let videoCounter = 0

  /**
   * A ready Mux video of the profile, with no item, written straight to the database. Returns its
   * media ID.
   */
  async function createVideoMedia(
    profileId: string,
    { seconds = 60, previewFetches = 0 }: { seconds?: number; previewFetches?: number } = {},
  ) {
    const n = ++videoCounter
    const [media] = await db
      .insert(s.mediaAssets)
      .values({
        profileId,
        kind: 'video',
        provider: 'mux',
        status: 'ready',
        playbackId: `pb_fixture_${n}`,
        durationSeconds: seconds,
        previewFetches,
        filename: `fixture-video-${n}.mp4`,
        mimeType: 'video/mp4',
      })
      .returning()
    if (!media) throw new Error('failed to create video media')
    return media.id
  }

  /**
   * A course with two lessons, a text artefact in the first and a quiz in the second, written
   * straight to the database. Enough content for every builder route to have something to act on.
   *
   * `videos: 1` adds a video item to the first lesson, and `videos: 2` one to the second lesson
   * too, each after the item already there, with its own ready Mux video of `videoSeconds`.
   */
  async function createCourse(
    profileId: string,
    options: {
      title?: string
      status?: 'draft' | 'pending_review' | 'live' | 'rejected'
      priceCents?: number
      videos?: 0 | 1 | 2
      videoSeconds?: number
    } = {},
  ) {
    const status = options.status ?? 'draft'
    const title = options.title ?? 'Fixture course'
    const [course] = await db
      .insert(s.courses)
      .values({
        profileId,
        title,
        slug: `fixture-course-${++courseCounter}-${Math.random().toString(36).slice(2, 8)}`,
        category: 'craft-making',
        status,
        priceCents: options.priceCents ?? 5000,
        ...(status === 'live' ? { publishedAt: clock } : {}),
      })
      .returning()
    if (!course) throw new Error('failed to create course')
    const [lessonA, lessonB] = await db
      .insert(s.lessons)
      .values([
        { courseId: course.id, title: 'First lesson', position: 0 },
        { courseId: course.id, title: 'Second lesson', position: 1 },
      ])
      .returning()
    if (!lessonA || !lessonB) throw new Error('failed to create lessons')
    const [text] = await db
      .insert(s.artefacts)
      .values({
        lessonId: lessonA.id,
        type: 'text',
        title: 'Read this',
        position: 0,
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Some words.' }] }],
        },
      })
      .returning()
    const [quizArtefact] = await db
      .insert(s.artefacts)
      .values({ lessonId: lessonB.id, type: 'quiz', title: 'Check yourself', position: 0 })
      .returning()
    if (!text || !quizArtefact) throw new Error('failed to create artefacts')
    const [quiz] = await db
      .insert(s.quizzes)
      .values({ artefactId: quizArtefact.id, questionsJson: [] })
      .returning()
    if (!quiz) throw new Error('failed to create quiz')
    const videos: Array<{ artefactId: string; mediaId: string }> = []
    for (const [index, lessonId] of [lessonA.id, lessonB.id]
      .slice(0, options.videos ?? 0)
      .entries()) {
      const mediaId = await createVideoMedia(profileId, { seconds: options.videoSeconds ?? 60 })
      const [item] = await db
        .insert(s.artefacts)
        .values({
          lessonId,
          type: 'video',
          title: `Fixture video ${index + 1}`,
          position: 1,
          mediaAssetId: mediaId,
          durationSeconds: options.videoSeconds ?? 60,
        })
        .returning()
      if (!item) throw new Error('failed to create video item')
      videos.push({ artefactId: item.id, mediaId })
    }
    return {
      videos,
      courseId: course.id,
      slug: course.slug,
      lessonA: lessonA.id,
      lessonB: lessonB.id,
      textArtefactId: text.id,
      quizArtefactId: quizArtefact.id,
      quizId: quiz.id,
    }
  }

  let classCounter = 0

  /**
   * A class of the profile, written straight to the database: published, in person, with its
   * venue position set and one block open at the test clock, taught by the profile's owner,
   * unless told otherwise. Each block is given as offsets in milliseconds from the test clock.
   * Returns the class and block IDs, blocks in order.
   */
  async function createClass(
    profileId: string,
    courseId: string,
    options: {
      name?: string
      status?: 'draft' | 'published'
      delivery?: 'in_person' | 'remote'
      instructorUserId?: string
      venueAddress?: string | null
      /** Null leaves the venue position unset. */
      venue?: { lat: number; lng: number; accuracyM: number; radiusM?: number } | null
      blocks?: { startMs: number; endMs: number }[]
      seats?: number
    } = {},
  ) {
    const profile = await db.query.profiles.findFirst({ where: { id: profileId } })
    if (!profile) throw new Error(`no profile ${profileId}`)
    const delivery = options.delivery ?? 'in_person'
    const status = options.status ?? 'published'
    const venue =
      options.venue === undefined
        ? delivery === 'in_person'
          ? { lat: 1.29, lng: 103.85, accuracyM: 10 }
          : null
        : options.venue
    const [row] = await db
      .insert(s.classes)
      .values({
        profileId,
        courseId,
        name: options.name ?? `Fixture class ${++classCounter}`,
        delivery,
        venueAddress:
          options.venueAddress === undefined
            ? delivery === 'in_person'
              ? '1 Fixture Road'
              : null
            : options.venueAddress,
        ...(venue
          ? {
              venueLat: venue.lat,
              venueLng: venue.lng,
              venueAccuracyM: venue.accuracyM,
              venueRadiusM: venue.radiusM ?? 200,
              venueSetAt: clock,
            }
          : {}),
        instructorUserId: options.instructorUserId ?? profile.ownerUserId,
        seats: options.seats ?? 20,
        status,
        publishedAt: status === 'published' ? clock : null,
      })
      .returning()
    if (!row) throw new Error('failed to create class')
    const spans = options.blocks ?? [{ startMs: -30 * 60_000, endMs: 3 * 60 * 60_000 }]
    const blocks = spans.length
      ? await db
          .insert(s.classBlocks)
          .values(
            spans.map((span, position) => ({
              classId: row.id,
              position,
              startsAt: new Date(clock.getTime() + span.startMs),
              endsAt: new Date(clock.getTime() + span.endMs),
              codeSecret: newBlockSecret(),
            })),
          )
          .returning()
      : []
    const blockIds = blocks.sort((a, b) => a.position - b.position).map((b) => b.id)
    return { classId: row.id, blockIds, blockId: blockIds[0] as string }
  }

  /** An active class enrollment for `email` in a class, written straight to the database. */
  async function enrolInClass(email: string, classId: string) {
    const user = await ensureUser(email)
    const found = await db.query.classes.findFirst({ where: { id: classId } })
    if (!found) throw new Error(`no class ${classId}`)
    const [enrollment] = await db
      .insert(s.enrollments)
      .values({
        userId: user.id,
        courseId: found.courseId,
        classId,
        status: 'active',
        enrolledAt: clock,
      })
      .returning()
    if (!enrollment) throw new Error('failed to enrol in the class')
    return enrollment
  }

  /** The code a block shows at `at` (default: the test clock): the typed one, or the link's. */
  async function validCodeFor(blockId: string, at?: Date, kind: 'typed' | 'link' = 'typed') {
    const block = await db.query.classBlocks.findFirst({ where: { id: blockId } })
    if (!block) throw new Error(`no block ${blockId}`)
    return codesFor(block.codeSecret, codePeriod(at ?? clock))[kind]
  }

  /** Delivers an event to the Stripe webhook route, signed the way the fake provider accepts. */
  async function stripeWebhook(event: PaymentsWebhookEvent) {
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'fake-valid' },
      body: JSON.stringify(event),
    })
    const text = await res.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    // biome-ignore lint/suspicious/noExplicitAny: test helper returns loosely typed JSON on purpose
    return { status: res.status, body: body as any }
  }

  return {
    app,
    db,
    client,
    mailer,
    storage,
    video,
    payments,
    deps,
    api,
    signIn,
    ensureUser,
    grantRole,
    createProfile,
    createCourse,
    createVideoMedia,
    addMember,
    enrol,
    createClass,
    enrolInClass,
    validCodeFor,
    makePayable,
    stripeWebhook,
    now: () => clock,
    setClock: (date: Date) => {
      clock = date
    },
    advanceClock: (ms: number) => {
      clock = new Date(clock.getTime() + ms)
    },
    close: () => client.close(),
  }
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>
