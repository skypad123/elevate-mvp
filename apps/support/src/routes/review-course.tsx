import { type ArtefactView, COURSE_CATEGORIES, type CourseView, formatSgd } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Dialog,
  EmptyState,
  formatDate,
  MediaPreview,
  PageHeader,
  RichTextView,
  Skeleton,
  statusLabel,
  statusTone,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, unwrap } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileAudio,
  FileText,
  Film,
  HelpCircle,
  Lock,
  X,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../lib/api'
import { reviewKeys, useReviewCourse } from '../lib/queries'

const ICON = { video: Film, audio: FileAudio, text: FileText, quiz: HelpCircle } as const

export function ReviewCourse() {
  const { courseId = '' } = useParams()
  const query = useReviewCourse(courseId)
  if (query.isPending) return <Skeleton className="h-80 w-full" />
  if (query.isError)
    return (
      <EmptyState tone="danger" title="Could not load course" body={errorMessage(query.error)} />
    )
  return <ReviewCourseView course={query.data} />
}

function ReviewCourseView({ course }: { course: CourseView }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = course.status === 'pending_review'
  const lessonTitle = new Map(course.lessons.map((l) => [l.id, l.title]))

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: reviewKeys.queue })
      await queryClient.invalidateQueries({ queryKey: reviewKeys.course(course.id) })
      toast({ tone: 'success', title: label })
      setDialog(null)
      navigate('/review')
    } catch (error) {
      toast({ tone: 'danger', title: `${label} failed`, description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Link
        to="/review"
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Review queue
      </Link>
      <PageHeader
        eyebrow={
          COURSE_CATEGORIES.find((c) => c.slug === course.category)?.label ?? course.category
        }
        title={course.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              by {course.profile.displayName} · {formatSgd(course.priceCents, { showFree: true })}
            </span>
            <Badge tone={statusTone[course.status]}>{statusLabel(course.status)}</Badge>
            {course.submittedAt ? (
              <span className="text-ink-tertiary">submitted {formatDate(course.submittedAt)}</span>
            ) : null}
          </span>
        }
        actions={
          pending ? (
            <>
              <Button variant="secondary" icon={X} onClick={() => setDialog('reject')}>
                Request changes
              </Button>
              <Button icon={Check} onClick={() => setDialog('approve')}>
                Approve and publish
              </Button>
            </>
          ) : null
        }
      />

      {course.rejectionReason && course.status === 'rejected' ? (
        <Card muted className="mb-6 border-warning text-small text-ink">
          <strong className="font-semibold">Last review note:</strong> {course.rejectionReason}
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card as="section">
            <CardHeader
              title="Course page"
              description="What learners will read before enrolling."
            />
            {course.thumbnail?.url ? (
              <img
                src={course.thumbnail.url}
                alt=""
                className="mb-4 aspect-[4/3] w-full max-w-md rounded-card object-cover"
              />
            ) : null}
            <p className="mb-4 text-body-lg text-ink-secondary">{course.summary}</p>
            <RichTextView doc={course.descriptionJson} />
          </Card>

          <section className="space-y-4">
            <h2 className="font-display text-h2 font-semibold text-ink">Curriculum</h2>
            {course.lessons.map((lesson, index) => (
              <Card key={lesson.id} as="article" className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
                      Lesson {index + 1}
                    </p>
                    <h3 className="font-display text-h3 font-semibold text-ink">{lesson.title}</h3>
                    {lesson.summary ? (
                      <p className="mt-1 text-small text-ink-secondary">{lesson.summary}</p>
                    ) : null}
                  </div>
                  {lesson.prerequisiteIds.length ? (
                    <p className="flex items-center gap-1 text-caption text-ink-tertiary">
                      <Lock className="size-3.5" /> Requires{' '}
                      {lesson.prerequisiteIds.map((id) => lessonTitle.get(id) ?? '?').join(', ')}
                    </p>
                  ) : null}
                </div>
                <ol className="space-y-4">
                  {lesson.artefacts.map((artefact) => (
                    <ArtefactPreview key={artefact.id} artefact={artefact} />
                  ))}
                </ol>
              </Card>
            ))}
          </section>
        </div>

        <div className="space-y-6">
          <Card as="section">
            <CardHeader
              title="Readiness"
              description="The same checklist the teacher saw before submitting."
            />
            {course.checklist.ok ? (
              <p className="flex items-center gap-2 text-small text-success">
                <CheckCircle2 className="size-4" /> All checks pass
              </p>
            ) : (
              <ul className="space-y-2">
                {course.checklist.problems.map((p) => (
                  <li
                    key={`${p.code}-${p.lessonId ?? ''}-${p.artefactId ?? ''}`}
                    className="flex items-start gap-2 text-small text-danger"
                  >
                    <XCircle className="mt-0.5 size-4 shrink-0" /> {p.message}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card as="section">
            <CardHeader title="Profile" />
            <DescriptionList
              items={[
                {
                  label: 'Name',
                  value: (
                    <Link
                      to={`/profiles/${course.profile.id}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      {course.profile.displayName}
                    </Link>
                  ),
                },
                { label: 'Owner', value: course.profile.ownerEmail },
                {
                  label: 'Payments',
                  value: course.profile.payable ? 'Can be paid' : 'Cannot be paid yet',
                },
                { label: 'Lessons', value: course.lessons.length },
                {
                  label: 'Items',
                  value: course.lessons.reduce((n, l) => n + l.artefacts.length, 0),
                },
              ]}
            />
          </Card>
        </div>
      </div>

      <Dialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Approve and publish?"
        description="The course goes live immediately and appears in Explore. The teacher is emailed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                act('Course published', async () =>
                  unwrap(
                    await api.support.courses[':id'].approve.$post({ param: { id: course.id } }),
                  ),
                )
              }
            >
              Approve
            </Button>
          </>
        }
      />
      <Dialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Request changes"
        description="Your note is emailed to the teacher and shown in their builder. They can edit and resubmit."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={reason.trim().length < 10}
              onClick={() =>
                act('Changes requested', async () =>
                  unwrap(
                    await api.support.courses[':id'].reject.$post({
                      param: { id: course.id },
                      json: { reason: reason.trim() },
                    }),
                  ),
                )
              }
            >
              Send to teacher
            </Button>
          </>
        }
      >
        <Textarea
          label="What needs to change?"
          rows={5}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </Dialog>
    </>
  )
}

function ArtefactPreview({ artefact }: { artefact: ArtefactView }) {
  const Icon = ICON[artefact.type]
  return (
    <li className="rounded-card border border-border bg-surface-muted/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-brand-fg" />
        <span className="font-semibold text-ink">{artefact.title}</span>
        <Badge>{statusLabel(artefact.type)}</Badge>
        {artefact.media ? (
          <Badge tone={statusTone[artefact.media.status]}>
            {statusLabel(artefact.media.status)}
          </Badge>
        ) : null}
        {artefact.durationSeconds ? (
          <span className="ml-auto text-caption text-ink-tertiary">
            {Math.max(1, Math.round(artefact.durationSeconds / 60))} min
          </span>
        ) : null}
      </div>
      {(artefact.type === 'video' || artefact.type === 'audio') && artefact.media ? (
        artefact.media.status === 'ready' ? (
          <MediaPreview api={api} assetId={artefact.media.id} />
        ) : (
          <p className="text-small text-ink-tertiary">Media is {artefact.media.status}.</p>
        )
      ) : null}
      {artefact.type === 'text' ? <RichTextView doc={artefact.contentJson} /> : null}
      {artefact.type === 'quiz' && artefact.quiz ? (
        <div className="space-y-3">
          <p className="text-caption text-ink-tertiary">
            Pass mark {artefact.quiz.passMarkPercent}% · {artefact.quiz.maxAttempts} attempt
            {artefact.quiz.maxAttempts === 1 ? '' : 's'}
            {artefact.quiz.timeLimitMinutes ? ` · ${artefact.quiz.timeLimitMinutes} min limit` : ''}
          </p>
          <ol className="space-y-2">
            {artefact.quiz.questions.map((q, i) => (
              <li key={q.id} className="text-small">
                <p className="font-semibold text-ink">
                  {i + 1}. {q.prompt}
                </p>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className={o.correct ? 'font-semibold text-success' : 'text-ink-secondary'}
                    >
                      {o.correct ? '✓ ' : '· '}
                      {o.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  )
}
