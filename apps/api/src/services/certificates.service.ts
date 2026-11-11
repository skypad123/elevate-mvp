import { ANALYTICS_EVENTS, type CertificateVerification, type CertificateView } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { listFallbackFonts, renderCertificatePdf } from '../lib/certificate-pdf'
import { certificateToken } from '../lib/crypto'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'

type CertificateRow = typeof s.certificates.$inferSelect

/** The name printed on the certificate: the profile name, or the email until one is set. */
const displayName = (user: { name: string | null; email: string }) =>
  user.name?.trim() || user.email

export class CertificatesService {
  constructor(private readonly deps: Deps) {}

  verifyUrl(token: string): string {
    return `${this.deps.env.LEARNER_URL}/c/${token}`
  }

  pdfUrl(token: string): string {
    return `${this.deps.env.API_URL}/api/certificates/${token}/pdf`
  }

  private view(row: CertificateRow): CertificateView {
    return {
      id: row.id,
      token: row.token,
      learnerName: row.learnerName,
      courseTitle: row.courseTitle,
      teacherName: row.teacherName,
      issuedAt: row.issuedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      verifyUrl: this.verifyUrl(row.token),
      pdfUrl: this.pdfUrl(row.token),
    }
  }

  /** Issues (once) the certificate for a completed enrollment: PDF to storage, row, email. */
  async issueForEnrollment(enrollmentId: string): Promise<CertificateView> {
    const { db, storage, mailer, env } = this.deps
    const existing = await db.query.certificates.findFirst({ where: { enrollmentId } })
    if (existing) return this.view(existing)
    const enrollment = await db.query.enrollments.findFirst({
      where: { id: enrollmentId },
      with: { user: true, course: { with: { teacher: { with: { teacherProfile: true } } } } },
    })
    if (!enrollment) throw errors.notFound('Enrollment')
    if (!enrollment.completedAt)
      throw errors.conflict('not_complete', 'The course has not been completed yet')

    const token = certificateToken()
    const issuedAt = this.deps.now()
    const learnerName = displayName(enrollment.user)
    const teacherName =
      enrollment.course.teacher.teacherProfile?.displayName ??
      enrollment.course.teacher.name ??
      'Elevate teacher'
    const pdf = await renderCertificatePdf(
      {
        learnerName,
        courseTitle: enrollment.course.title,
        teacherName,
        issuedAt,
        verifyUrl: this.verifyUrl(token),
        token,
      },
      { fallbackFonts: await listFallbackFonts(env.CERTIFICATE_FALLBACK_FONTS) },
    )
    const storageKey = `certificates/${enrollmentId}/${token}.pdf`
    await storage.put(storageKey, pdf, 'application/pdf')
    const [row] = await db
      .insert(s.certificates)
      .values({
        enrollmentId,
        token,
        pdfStorageKey: storageKey,
        learnerName,
        courseTitle: enrollment.course.title,
        teacherName,
        issuedAt,
      })
      .onConflictDoNothing()
      .returning()
    const certificate = row ?? (await db.query.certificates.findFirst({ where: { enrollmentId } }))
    if (!certificate) throw new Error('failed to issue certificate')
    await trackEvent(this.deps, {
      userId: enrollment.userId,
      name: ANALYTICS_EVENTS.certificateIssued,
      properties: { courseId: enrollment.courseId, certificateId: certificate.id },
    })
    await recordAudit(this.deps, {
      actorId: null,
      action: 'certificate.issue',
      entityType: 'certificate',
      entityId: certificate.id,
      metadata: { enrollmentId },
    })
    await mailer.send(
      simpleEmail({
        to: enrollment.user.email,
        title: `Your certificate: ${enrollment.course.title}`,
        paragraphs: [
          `Congratulations, ${learnerName}. You completed "${enrollment.course.title}" by ${teacherName}.`,
          `Anyone can verify it at ${this.verifyUrl(token)} — no sign-in needed.`,
        ],
        cta: {
          href: `${env.LEARNER_URL}/learn/${enrollmentId}/certificate`,
          label: 'View certificate',
        },
      }),
    )
    return this.view(certificate)
  }

  async forEnrollment(user: SessionUser, enrollmentId: string): Promise<CertificateView> {
    const enrollment = await this.deps.db.query.enrollments.findFirst({
      where: { id: enrollmentId },
      with: { certificate: true, user: { columns: { name: true, email: true } } },
    })
    if (!enrollment || enrollment.userId !== user.id) throw errors.notFound('Enrollment')
    if (enrollment.certificate)
      return this.refreshName(user, enrollment.certificate, enrollment.user)
    if (enrollment.completedAt) return this.issueForEnrollment(enrollmentId)
    throw errors.notFound('Certificate')
  }

  /**
   * The PDF snapshots the learner's name at issue time. If they add or correct their profile name
   * later, reprint under the same token so every verify link and QR code stays valid.
   */
  private async refreshName(
    actor: SessionUser,
    certificate: CertificateRow,
    learner: { name: string | null; email: string },
  ): Promise<CertificateView> {
    const learnerName = displayName(learner)
    if (certificate.revokedAt || learnerName === certificate.learnerName)
      return this.view(certificate)
    const pdf = await renderCertificatePdf(
      {
        learnerName,
        courseTitle: certificate.courseTitle,
        teacherName: certificate.teacherName,
        issuedAt: certificate.issuedAt,
        verifyUrl: this.verifyUrl(certificate.token),
        token: certificate.token,
      },
      { fallbackFonts: await listFallbackFonts(this.deps.env.CERTIFICATE_FALLBACK_FONTS) },
    )
    const storageKey =
      certificate.pdfStorageKey ??
      `certificates/${certificate.enrollmentId}/${certificate.token}.pdf`
    await this.deps.storage.put(storageKey, pdf, 'application/pdf')
    const [updated] = await this.deps.db
      .update(s.certificates)
      .set({ learnerName, pdfStorageKey: storageKey })
      .where(eq(s.certificates.id, certificate.id))
      .returning()
    await recordAudit(this.deps, {
      actorId: actor.id,
      action: 'certificate.reprint',
      entityType: 'certificate',
      entityId: certificate.id,
      metadata: { from: certificate.learnerName, to: learnerName },
    })
    return this.view(updated ?? { ...certificate, learnerName, pdfStorageKey: storageKey })
  }

  async verify(token: string): Promise<CertificateVerification> {
    const row = await this.deps.db.query.certificates.findFirst({
      where: { token },
      with: { enrollment: { with: { course: { columns: { slug: true } } } } },
    })
    if (!row) return { valid: false, reason: 'not_found' }
    if (row.revokedAt)
      return { valid: false, reason: 'revoked', revokedAt: row.revokedAt.toISOString() }
    return { valid: true, certificate: this.view(row), courseSlug: row.enrollment.course.slug }
  }

  async pdf(
    token: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; size: number; filename: string }> {
    const row = await this.deps.db.query.certificates.findFirst({ where: { token } })
    if (!row || row.revokedAt || !row.pdfStorageKey) throw errors.notFound('Certificate')
    const object = await this.deps.storage.get(row.pdfStorageKey)
    if (!object) throw errors.notFound('Certificate file')
    return {
      body: object.body,
      size: object.size,
      filename: `elevate-certificate-${row.token}.pdf`,
    }
  }
}
