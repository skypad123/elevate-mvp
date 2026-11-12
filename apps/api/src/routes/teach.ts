import {
  type Capability,
  createArtefactSchema,
  createCourseSchema,
  createLessonSchema,
  personalApplicationSchema,
  prerequisitesSchema,
  reorderSchema,
  setPriceSchema,
  updateArtefactSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateProfileSchema,
  upsertQuizSchema,
} from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import {
  type AppEnv,
  ensureActor,
  ensureUser,
  requireProfile,
  requireRecentSignIn,
  requireUser,
  uuidParam,
} from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { ConnectService } from '../services/connect.service'
import { CoursesService } from '../services/courses.service'
import { EarningsService } from '../services/earnings.service'
import { ProfilesService } from '../services/profiles.service'

/**
 * Elevate Teach. Two routes sit outside a profile: listing the caller's profiles and applying for
 * one. Everything else is under `/profiles/:profileId` and names the capability it needs.
 *
 * Content routes (course details, lessons, artefacts, quizzes) ask for `profile.read` here and
 * leave the rest to `CoursesService`, because the capability depends on the course's status:
 * `course.editDraft` for a draft or rejected course, `course.editLive` for a live one.
 */
export const teachRoutes = (deps: Deps) => {
  const profiles = new ProfilesService(deps)
  const connect = new ConnectService(deps)
  const courses = new CoursesService(deps)
  const earnings = new EarningsService(deps)
  const on = (capability: Capability) => requireProfile(deps, capability)
  const recentSignIn = requireRecentSignIn(deps)
  const courseId = uuidParam('id', 'Course')
  const lessonId = uuidParam('id', 'Lesson')
  const artefactId = uuidParam('id', 'Artefact')

  return (
    new Hono<AppEnv>()
      // ── outside a profile ──
      .get('/profiles', requireUser(), async (c) => {
        const items = profiles.listForUser(ensureUser(c.get('user')))
        return c.json({ items }, 200)
      })
      .post('/apply', requireUser(), validate('json', personalApplicationSchema), async (c) => {
        const profile = await profiles.apply(ensureUser(c.get('user')), c.req.valid('json'))
        return c.json({ profile }, 200)
      })
      // ── the profile ──
      .get('/profiles/:profileId/profile', on('profile.read'), async (c) => {
        const profile = await profiles.getProfile(ensureActor(c.get('actor')))
        return c.json({ profile }, 200)
      })
      .patch(
        '/profiles/:profileId/profile',
        on('profile.edit'),
        validate('json', updateProfileSchema),
        async (c) => {
          const profile = await profiles.updateProfile(
            ensureUser(c.get('user')),
            ensureActor(c.get('actor')),
            c.req.valid('json'),
          )
          return c.json({ profile }, 200)
        },
      )
      // ── Stripe ──
      // Not read-only: it asks Stripe for the account's state and stores it, which can activate
      // the account. The result is the state the webhook would set. Anyone on the profile can
      // trigger it, so it is limited per user.
      .get(
        '/profiles/:profileId/stripe/status',
        on('profile.read'),
        rateLimit({ name: 'stripe-status', limit: 30, windowMs: 60_000 }),
        async (c) => {
          const stripe = await connect.syncStatus(ensureActor(c.get('actor')).profileId)
          return c.json({ stripe }, 200)
        },
      )
      .post(
        '/profiles/:profileId/stripe/onboarding-link',
        on('stripe.links'),
        recentSignIn,
        async (c) => {
          const link = await connect.onboardingLink(ensureActor(c.get('actor')))
          return c.json(link, 200)
        },
      )
      .post(
        '/profiles/:profileId/stripe/login-link',
        on('stripe.links'),
        recentSignIn,
        async (c) => {
          const link = await connect.loginLink(ensureActor(c.get('actor')))
          return c.json(link, 200)
        },
      )
      // ── earnings ──
      .get('/profiles/:profileId/earnings', on('earnings.read'), async (c) =>
        c.json({ earnings: await earnings.forProfile(ensureActor(c.get('actor'))) }, 200),
      )
      .get('/profiles/:profileId/earnings/reconcile', on('earnings.read'), async (c) =>
        c.json({ reconciliation: await earnings.reconcile(ensureActor(c.get('actor'))) }, 200),
      )
      .get('/profiles/:profileId/earnings/courses/:id', on('earnings.read'), courseId, async (c) =>
        c.json(
          { earnings: await earnings.forCourse(ensureActor(c.get('actor')), c.req.param('id')) },
          200,
        ),
      )
      // ── courses ──
      .get('/profiles/:profileId/courses', on('profile.read'), async (c) => {
        const items = await courses.listForProfile(ensureActor(c.get('actor')))
        return c.json({ items }, 200)
      })
      .post(
        '/profiles/:profileId/courses',
        on('course.create'),
        validate('json', createCourseSchema),
        async (c) => {
          const course = await courses.create(ensureActor(c.get('actor')), c.req.valid('json'))
          return c.json({ course }, 200)
        },
      )
      .get('/profiles/:profileId/courses/:id', on('profile.read'), courseId, async (c) => {
        const course = await courses.view(ensureActor(c.get('actor')), c.req.param('id'))
        return c.json({ course }, 200)
      })
      .patch(
        '/profiles/:profileId/courses/:id',
        on('profile.read'),
        courseId,
        validate('json', updateCourseSchema),
        async (c) => {
          const course = await courses.update(
            ensureUser(c.get('user')),
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .put(
        '/profiles/:profileId/courses/:id/price',
        on('course.setPrice'),
        courseId,
        validate('json', setPriceSchema),
        async (c) => {
          const course = await courses.setPrice(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json').priceCents,
          )
          return c.json({ course }, 200)
        },
      )
      .delete('/profiles/:profileId/courses/:id', on('course.delete'), courseId, async (c) => {
        await courses.remove(ensureActor(c.get('actor')), c.req.param('id'))
        return c.json({ ok: true }, 200)
      })
      .post('/profiles/:profileId/courses/:id/submit', on('course.submit'), courseId, async (c) => {
        const course = await courses.submit(ensureActor(c.get('actor')), c.req.param('id'))
        return c.json({ course }, 200)
      })
      .post(
        '/profiles/:profileId/courses/:id/lessons',
        on('profile.read'),
        courseId,
        validate('json', createLessonSchema),
        async (c) => {
          const course = await courses.addLesson(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .put(
        '/profiles/:profileId/courses/:id/lessons/order',
        on('profile.read'),
        courseId,
        validate('json', reorderSchema),
        async (c) => {
          const course = await courses.reorderLessons(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json').ids,
          )
          return c.json({ course }, 200)
        },
      )
      // ── lessons ──
      .patch(
        '/profiles/:profileId/lessons/:id',
        on('profile.read'),
        lessonId,
        validate('json', updateLessonSchema),
        async (c) => {
          const course = await courses.updateLesson(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .delete('/profiles/:profileId/lessons/:id', on('profile.read'), lessonId, async (c) => {
        const course = await courses.removeLesson(ensureActor(c.get('actor')), c.req.param('id'))
        return c.json({ course }, 200)
      })
      .put(
        '/profiles/:profileId/lessons/:id/prerequisites',
        on('profile.read'),
        lessonId,
        validate('json', prerequisitesSchema),
        async (c) => {
          const course = await courses.setPrerequisites(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json').prerequisiteIds,
          )
          return c.json({ course }, 200)
        },
      )
      .post(
        '/profiles/:profileId/lessons/:id/artefacts',
        on('profile.read'),
        lessonId,
        validate('json', createArtefactSchema),
        async (c) => {
          const course = await courses.addArtefact(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .put(
        '/profiles/:profileId/lessons/:id/artefacts/order',
        on('profile.read'),
        lessonId,
        validate('json', reorderSchema),
        async (c) => {
          const course = await courses.reorderArtefacts(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json').ids,
          )
          return c.json({ course }, 200)
        },
      )
      // ── artefacts ──
      .patch(
        '/profiles/:profileId/artefacts/:id',
        on('profile.read'),
        artefactId,
        validate('json', updateArtefactSchema),
        async (c) => {
          const course = await courses.updateArtefact(
            ensureUser(c.get('user')),
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .delete('/profiles/:profileId/artefacts/:id', on('profile.read'), artefactId, async (c) => {
        const course = await courses.removeArtefact(ensureActor(c.get('actor')), c.req.param('id'))
        return c.json({ course }, 200)
      })
      .put(
        '/profiles/:profileId/artefacts/:id/quiz',
        on('profile.read'),
        artefactId,
        validate('json', upsertQuizSchema),
        async (c) => {
          const course = await courses.upsertQuiz(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
  )
}
