import { progressUpdateSchema, quizSubmitSchema } from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireUser } from '../middleware/auth'
import { CertificatesService } from '../services/certificates.service'
import { LearningService } from '../services/learning.service'

/** Learner-side player endpoints, mounted at /me/enrollments/:id. */
export const learningRoutes = (
  deps: Deps,
  learning = new LearningService(deps),
  certificates = new CertificatesService(deps),
) => {
  learning.onCompleted = (enrollmentId) =>
    certificates.issueForEnrollment(enrollmentId).then(() => undefined)
  return new Hono<AppEnv>()
    .get('/:id', requireUser(), async (c) =>
      c.json(
        { enrollment: await learning.detail(ensureUser(c.get('user')), c.req.param('id')) },
        200,
      ),
    )
    .get('/:id/lessons/:lessonId', requireUser(), async (c) =>
      c.json(
        {
          lesson: await learning.lessonContent(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.param('lessonId'),
          ),
        },
        200,
      ),
    )
    .post(
      '/:id/artefacts/:artefactId/progress',
      requireUser(),
      validate('json', progressUpdateSchema),
      async (c) =>
        c.json(
          await learning.updateProgress(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.param('artefactId'),
            c.req.valid('json'),
          ),
          200,
        ),
    )
    .post('/:id/quizzes/:quizId/attempts', requireUser(), async (c) =>
      c.json(
        await learning.startAttempt(
          ensureUser(c.get('user')),
          c.req.param('id'),
          c.req.param('quizId'),
        ),
        200,
      ),
    )
    .post(
      '/:id/quizzes/:quizId/attempts/:attemptId/submit',
      requireUser(),
      validate('json', quizSubmitSchema),
      async (c) =>
        c.json(
          await learning.submitAttempt(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.param('quizId'),
            c.req.param('attemptId'),
            c.req.valid('json').answers,
          ),
          200,
        ),
    )
    .get('/:id/certificate', requireUser(), async (c) =>
      c.json(
        {
          certificate: await certificates.forEnrollment(
            ensureUser(c.get('user')),
            c.req.param('id'),
          ),
        },
        200,
      ),
    )
}
