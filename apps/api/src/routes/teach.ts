import {
  type Capability,
  changeRoleSchema,
  courseViewQuerySchema,
  createArtefactSchema,
  createCourseSchema,
  createLessonSchema,
  inviteSchema,
  personalApplicationSchema,
  prerequisitesSchema,
  reorderSchema,
  resolveChangeSetSchema,
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
import { ChangeSetsService } from '../services/change-sets.service'
import { ConnectService } from '../services/connect.service'
import { CoursesService } from '../services/courses.service'
import { EarningsService } from '../services/earnings.service'
import { MembersService } from '../services/members.service'
import { ProfilesService } from '../services/profiles.service'

/**
 * Elevate Teach. A few routes sit outside a profile: listing the caller's profiles, applying for
 * one, and the two invitation routes, which are for someone who is not a member yet. Everything
 * else is under `/profiles/:profileId` and names the capability it needs.
 *
 * Content routes (course details, lessons, artefacts, quizzes) ask for `profile.read` here and
 * leave the rest to `CoursesService`, because the capability depends on the course's status:
 * `course.editDraft` for a draft or rejected course; for a live one `course.editLive`, or
 * `course.proposeLiveEdit` for edits that wait in a change set.
 *
 * Member routes ask for `members.manageWriters` here, and `MembersService` asks for
 * `members.manageManagers` when the invitation or member in question is a manager.
 */
export const teachRoutes = (deps: Deps) => {
  const profiles = new ProfilesService(deps)
  const connect = new ConnectService(deps)
  const courses = new CoursesService(deps)
  const changeSets = new ChangeSetsService(deps)
  const members = new MembersService(deps)
  const earnings = new EarningsService(deps)
  const on = (capability: Capability) => requireProfile(deps, capability)
  const recentSignIn = requireRecentSignIn(deps)
  const courseId = uuidParam('id', 'Course')
  const lessonId = uuidParam('id', 'Lesson')
  const artefactId = uuidParam('id', 'Artefact')
  const invitationId = uuidParam('id', 'Invitation')
  const memberId = uuidParam('userId', 'Member')
  // The token is 256 random bits, so guessing is not the worry; this keeps the lookups cheap.
  const invitationLimit = rateLimit({ name: 'invitation', limit: 60, windowMs: 60_000 })

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
      // The invitation page reads this before the invitee has signed in: the token is the proof.
      .get('/invitations/:token', invitationLimit, async (c) => {
        const invitation = await members.preview(c.req.param('token'))
        return c.json({ invitation }, 200)
      })
      .post('/invitations/:token/accept', requireUser(), invitationLimit, async (c) => {
        const accepted = await members.accept(c.req.param('token'), ensureUser(c.get('user')))
        return c.json({ accepted }, 200)
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
      // ── members and invitations ──
      .get('/profiles/:profileId/members', on('members.read'), async (c) =>
        c.json(await members.list(ensureActor(c.get('actor'))), 200),
      )
      .post(
        '/profiles/:profileId/invitations',
        on('members.manageWriters'),
        validate('json', inviteSchema),
        async (c) => {
          const sent = await members.invite(
            ensureUser(c.get('user')),
            ensureActor(c.get('actor')),
            c.req.valid('json'),
          )
          return c.json(sent, 200)
        },
      )
      .post(
        '/profiles/:profileId/invitations/:id/resend',
        on('members.manageWriters'),
        invitationId,
        async (c) => {
          const sent = await members.resend(
            ensureUser(c.get('user')),
            ensureActor(c.get('actor')),
            c.req.param('id'),
          )
          return c.json(sent, 200)
        },
      )
      .delete(
        '/profiles/:profileId/invitations/:id',
        on('members.manageWriters'),
        invitationId,
        async (c) =>
          c.json(
            await members.revoke(
              ensureUser(c.get('user')),
              ensureActor(c.get('actor')),
              c.req.param('id'),
            ),
            200,
          ),
      )
      .post(
        '/profiles/:profileId/invitations/:id/confirm',
        on('members.manageManagers'),
        invitationId,
        async (c) =>
          c.json(
            await members.confirm(
              ensureUser(c.get('user')),
              ensureActor(c.get('actor')),
              c.req.param('id'),
            ),
            200,
          ),
      )
      // Leaving needs no capability: it is for a member, whatever their role. Registered before
      // `members/:userId` so that `me` is not read as a user ID.
      .delete('/profiles/:profileId/members/me', requireProfile(deps), async (c) => {
        await members.leave(ensureActor(c.get('actor')))
        return c.json({ ok: true }, 200)
      })
      .delete(
        '/profiles/:profileId/members/:userId',
        on('members.manageWriters'),
        memberId,
        async (c) =>
          c.json(
            await members.remove(
              ensureUser(c.get('user')),
              ensureActor(c.get('actor')),
              c.req.param('userId'),
            ),
            200,
          ),
      )
      .patch(
        '/profiles/:profileId/members/:userId',
        on('members.manageManagers'),
        memberId,
        validate('json', changeRoleSchema),
        async (c) =>
          c.json(
            await members.changeRole(
              ensureUser(c.get('user')),
              ensureActor(c.get('actor')),
              c.req.param('userId'),
              c.req.valid('json').role,
            ),
            200,
          ),
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
      // `?draft=1` returns the rows of the course's open change set, with their own IDs and
      // each item's `sourceId`. Without it, or with no change set open, the live rows.
      .get(
        '/profiles/:profileId/courses/:id',
        on('profile.read'),
        courseId,
        validate('query', courseViewQuerySchema),
        async (c) => {
          const course = await courses.view(ensureActor(c.get('actor')), c.req.param('id'), {
            draft: c.req.valid('query').draft === '1',
          })
          return c.json({ course }, 200)
        },
      )
      .patch(
        '/profiles/:profileId/courses/:id',
        on('profile.read'),
        courseId,
        validate('json', updateCourseSchema),
        async (c) => {
          const course = await courses.update(
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
      // ── change sets: a writer's edits to a live course, waiting for approval ──
      .get(
        '/profiles/:profileId/courses/:id/change-set',
        on('profile.read'),
        courseId,
        async (c) => {
          const changeSet = await changeSets.get(ensureActor(c.get('actor')), c.req.param('id'))
          return c.json({ changeSet }, 200)
        },
      )
      .post(
        '/profiles/:profileId/courses/:id/change-set/resolve',
        on('changeSet.review'),
        courseId,
        validate('json', resolveChangeSetSchema),
        async (c) => {
          const changeSet = await changeSets.resolveConflicts(
            ensureActor(c.get('actor')),
            c.req.param('id'),
            c.req.valid('json').choices,
          )
          return c.json({ changeSet }, 200)
        },
      )
      .post(
        '/profiles/:profileId/courses/:id/change-set/approve',
        on('changeSet.review'),
        courseId,
        async (c) => {
          const actor = ensureActor(c.get('actor'))
          await changeSets.approve(actor, c.req.param('id'))
          return c.json({ course: await courses.view(actor, c.req.param('id')) }, 200)
        },
      )
      .post(
        '/profiles/:profileId/courses/:id/change-set/discard',
        on('changeSet.review'),
        courseId,
        async (c) => {
          const actor = ensureActor(c.get('actor'))
          await changeSets.discard(actor, c.req.param('id'))
          return c.json({ course: await courses.view(actor, c.req.param('id')) }, 200)
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
