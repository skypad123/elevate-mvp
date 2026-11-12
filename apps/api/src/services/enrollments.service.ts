import type { EnrollmentSummary } from '@elevate/core'
import { inArray } from 'drizzle-orm'
import type { Deps } from '../deps'
import { CatalogService } from './catalog.service'

export class EnrollmentsService {
  private readonly catalog: CatalogService
  constructor(private readonly deps: Deps) {
    this.catalog = new CatalogService(deps)
  }

  /** My Learning. Progress counts live artefacts only, so a writer's drafts never move it. */
  async listForUser(userId: string): Promise<EnrollmentSummary[]> {
    const rows = await this.deps.learnerDb.query.enrollments.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      with: {
        course: {
          with: {
            thumbnail: true,
            profile: true,
            liveLessons: {
              columns: { id: true },
              with: { liveArtefacts: { columns: { id: true } } },
            },
          },
        },
        progress: { orderBy: { updatedAt: 'asc' } },
        certificate: true,
      },
    })
    const visible = rows.filter((r) => r.status !== 'pending_payment' || r.stripeCheckoutSessionId)
    const out: EnrollmentSummary[] = []
    for (const row of visible) {
      if (row.status === 'pending_payment') continue
      const totalArtefacts = row.course.liveLessons.reduce((n, l) => n + l.liveArtefacts.length, 0)
      const completedArtefacts = row.progress.filter((p) => p.status === 'completed').length
      const last = row.progress.at(-1)
      out.push({
        id: row.id,
        status: row.status,
        enrolledAt: row.enrolledAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        course: await this.catalog.toCard(row.course),
        progress: {
          completedArtefacts,
          totalArtefacts,
          percent: totalArtefacts ? Math.round((completedArtefacts / totalArtefacts) * 100) : 0,
        },
        certificateId: row.certificate?.id ?? null,
        lastActivityAt: last?.updatedAt.toISOString() ?? null,
      })
    }
    return out
  }

  async activeCourseIds(userId: string): Promise<Set<string>> {
    const rows = await this.deps.db.query.enrollments.findMany({
      where: { userId },
      columns: { courseId: true, status: true },
    })
    return new Set(rows.filter((r) => r.status === 'active').map((r) => r.courseId))
  }

  async ensureActive(userId: string, enrollmentId: string) {
    const enrollment = await this.deps.db.query.enrollments.findFirst({
      where: { id: enrollmentId },
    })
    if (!enrollment || enrollment.userId !== userId) return null
    if (!inArray) return null
    return enrollment.status === 'active' ? enrollment : null
  }
}
