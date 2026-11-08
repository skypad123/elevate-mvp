import {
  createArtefactSchema,
  createCourseSchema,
  createLessonSchema,
  prerequisitesSchema,
  reorderSchema,
  teacherApplicationSchema,
  updateArtefactSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateTeacherProfileSchema,
  upsertQuizSchema,
} from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireRole, requireUser } from '../middleware/auth'
import { ConnectService } from '../services/connect.service'
import { CoursesService } from '../services/courses.service'
import { EarningsService } from '../services/earnings.service'
import { TeachersService } from '../services/teachers.service'

export const teachRoutes = (deps: Deps) => {
  const teachers = new TeachersService(deps)
  const connect = new ConnectService(deps)
  const courses = new CoursesService(deps)
  const earnings = new EarningsService(deps)
  return (
    new Hono<AppEnv>()
      .get('/profile', requireUser(), async (c) => {
        const profile = await teachers.getProfile(ensureUser(c.get('user')).id)
        return c.json({ profile }, 200)
      })
      .post('/apply', requireUser(), validate('json', teacherApplicationSchema), async (c) => {
        const profile = await teachers.apply(ensureUser(c.get('user')), c.req.valid('json'))
        return c.json({ profile }, 200)
      })
      .patch(
        '/profile',
        requireRole('teacher'),
        validate('json', updateTeacherProfileSchema),
        async (c) => {
          const profile = await teachers.updateProfile(
            ensureUser(c.get('user')),
            c.req.valid('json'),
          )
          return c.json({ profile }, 200)
        },
      )
      .post('/stripe/onboarding-link', requireRole('teacher'), async (c) => {
        const link = await connect.onboardingLink(ensureUser(c.get('user')).id)
        return c.json(link, 200)
      })
      .get('/stripe/status', requireRole('teacher'), async (c) => {
        const status = await connect.syncStatus(ensureUser(c.get('user')).id)
        return c.json({ stripe: status }, 200)
      })
      .post('/stripe/login-link', requireRole('teacher'), async (c) => {
        const link = await connect.loginLink(ensureUser(c.get('user')).id)
        return c.json(link, 200)
      })
      // ── earnings ──
      .get('/earnings', requireRole('teacher'), async (c) =>
        c.json({ earnings: await earnings.forTeacher(ensureUser(c.get('user'))) }, 200),
      )
      .get('/earnings/reconcile', requireRole('teacher'), async (c) =>
        c.json({ reconciliation: await earnings.reconcile(ensureUser(c.get('user'))) }, 200),
      )
      .get('/earnings/courses/:id', requireRole('teacher'), async (c) =>
        c.json(
          { earnings: await earnings.forCourse(ensureUser(c.get('user')), c.req.param('id')) },
          200,
        ),
      )
      // ── courses ──
      .get('/courses', requireRole('teacher'), async (c) => {
        const items = await courses.listForTeacher(ensureUser(c.get('user')))
        return c.json({ items }, 200)
      })
      .post('/courses', requireRole('teacher'), validate('json', createCourseSchema), async (c) => {
        const course = await courses.create(ensureUser(c.get('user')), c.req.valid('json'))
        return c.json({ course }, 200)
      })
      .get('/courses/:id', requireRole('teacher'), async (c) => {
        const user = ensureUser(c.get('user'))
        const course = await courses.loadCourseView(c.req.param('id'))
        if (course.teacher.id !== user.id && !user.roles.includes('super_admin'))
          return c.json({ error: { code: 'forbidden', message: 'Not your course' } }, 403)
        return c.json({ course }, 200)
      })
      .patch(
        '/courses/:id',
        requireRole('teacher'),
        validate('json', updateCourseSchema),
        async (c) => {
          const course = await courses.update(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .delete('/courses/:id', requireRole('teacher'), async (c) => {
        await courses.remove(ensureUser(c.get('user')), c.req.param('id'))
        return c.json({ ok: true }, 200)
      })
      .post('/courses/:id/submit', requireRole('teacher'), async (c) => {
        const course = await courses.submit(ensureUser(c.get('user')), c.req.param('id'))
        return c.json({ course }, 200)
      })
      .post(
        '/courses/:id/lessons',
        requireRole('teacher'),
        validate('json', createLessonSchema),
        async (c) => {
          const course = await courses.addLesson(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .put(
        '/courses/:id/lessons/order',
        requireRole('teacher'),
        validate('json', reorderSchema),
        async (c) => {
          const course = await courses.reorderLessons(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json').ids,
          )
          return c.json({ course }, 200)
        },
      )
      // ── lessons ──
      .patch(
        '/lessons/:id',
        requireRole('teacher'),
        validate('json', updateLessonSchema),
        async (c) => {
          const course = await courses.updateLesson(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .delete('/lessons/:id', requireRole('teacher'), async (c) => {
        const course = await courses.removeLesson(ensureUser(c.get('user')), c.req.param('id'))
        return c.json({ course }, 200)
      })
      .put(
        '/lessons/:id/prerequisites',
        requireRole('teacher'),
        validate('json', prerequisitesSchema),
        async (c) => {
          const course = await courses.setPrerequisites(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json').prerequisiteIds,
          )
          return c.json({ course }, 200)
        },
      )
      .post(
        '/lessons/:id/artefacts',
        requireRole('teacher'),
        validate('json', createArtefactSchema),
        async (c) => {
          const course = await courses.addArtefact(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .put(
        '/lessons/:id/artefacts/order',
        requireRole('teacher'),
        validate('json', reorderSchema),
        async (c) => {
          const course = await courses.reorderArtefacts(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json').ids,
          )
          return c.json({ course }, 200)
        },
      )
      // ── artefacts ──
      .patch(
        '/artefacts/:id',
        requireRole('teacher'),
        validate('json', updateArtefactSchema),
        async (c) => {
          const course = await courses.updateArtefact(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
      .delete('/artefacts/:id', requireRole('teacher'), async (c) => {
        const course = await courses.removeArtefact(ensureUser(c.get('user')), c.req.param('id'))
        return c.json({ course }, 200)
      })
      .put(
        '/artefacts/:id/quiz',
        requireRole('teacher'),
        validate('json', upsertQuizSchema),
        async (c) => {
          const course = await courses.upsertQuiz(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ course }, 200)
        },
      )
  )
}
