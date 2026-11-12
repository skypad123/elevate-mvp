import type { CourseView, SubmissionProblem } from '@elevate/core'
import { Badge, Button, Card, CardHeader, useToast } from '@elevate/web-ui'
import { CheckCircle2, ExternalLink, Send, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useCourseActions } from '../lib/courses'
import { useCurrentProfile } from '../lib/profile'
import { useSaveTracker } from '../lib/save-tracker'
import { learnerUrl } from '../lib/urls'

type Tab = 'curriculum' | 'map' | 'details' | 'review'

const TAB_FOR_CODE: Record<SubmissionProblem['code'], Tab | 'settings'> = {
  title: 'details',
  summary: 'details',
  category: 'details',
  description: 'details',
  thumbnail: 'details',
  price: 'details',
  no_lessons: 'curriculum',
  empty_lesson: 'curriculum',
  media_not_ready: 'curriculum',
  empty_text: 'curriculum',
  empty_quiz: 'curriculum',
  prerequisites: 'map',
  stripe: 'settings',
}

export function ReviewPanel({
  course,
  onGoTo,
}: {
  course: CourseView
  onGoTo: (tab: Tab) => void
}) {
  const actions = useCourseActions(course.id)
  const { path, can } = useCurrentProfile()
  const { track } = useSaveTracker()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const { checklist } = course
  const lessonTitle = new Map(course.lessons.map((l) => [l.id, l.title]))
  const totalItems = course.lessons.reduce((n, l) => n + l.artefacts.length, 0)
  const totalMinutes = Math.round(
    course.lessons.reduce(
      (n, l) => n + l.artefacts.reduce((m, a) => m + (a.durationSeconds ?? 0), 0),
      0,
    ) / 60,
  )

  async function submit() {
    setBusy(true)
    try {
      await track(actions.submitCourse())
      toast({
        tone: 'success',
        title: 'Submitted for review',
        description: 'We will email you when a reviewer has looked at it.',
      })
    } catch {
      // toasted by actions
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card as="section">
        <CardHeader
          title="Readiness checklist"
          description="Everything here must pass before you can submit."
        />
        {checklist.ok ? (
          <p className="flex items-center gap-2 text-body text-success">
            <CheckCircle2 className="size-5" /> Ready to submit.
          </p>
        ) : (
          <ul className="space-y-2">
            {checklist.problems.map((p) => {
              const target = TAB_FOR_CODE[p.code]
              return (
                <li
                  key={`${p.code}-${p.lessonId ?? ''}-${p.artefactId ?? ''}`}
                  className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2"
                >
                  <span className="flex items-start gap-2 text-small text-ink">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
                    <span>
                      {p.message}
                      {p.lessonId ? (
                        <span className="text-ink-tertiary"> · {lessonTitle.get(p.lessonId)}</span>
                      ) : null}
                    </span>
                  </span>
                  {target === 'settings' ? (
                    <Link to={path('/settings')}>
                      <Button variant="ghost" size="sm">
                        Open settings
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => onGoTo(target)}>
                      Fix
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <div className="space-y-6">
        <Card as="section" className="space-y-4">
          <CardHeader
            title="Status"
            action={
              <Badge
                tone={
                  course.status === 'live'
                    ? 'success'
                    : course.status === 'pending_review'
                      ? 'warning'
                      : course.status === 'rejected'
                        ? 'danger'
                        : 'neutral'
                }
              >
                {course.status.replace('_', ' ')}
              </Badge>
            }
          />
          <p className="text-small text-ink-secondary">
            {course.lessons.length} lesson{course.lessons.length === 1 ? '' : 's'} · {totalItems}{' '}
            item{totalItems === 1 ? '' : 's'}
            {totalMinutes ? ` · about ${totalMinutes} min` : ''}
          </p>
          {course.status === 'rejected' && course.rejectionReason ? (
            <blockquote className="rounded-card border-l-4 border-warning bg-warning-tint p-3 text-small text-ink">
              {course.rejectionReason}
            </blockquote>
          ) : null}
          {course.status === 'pending_review' ? (
            <p className="text-small text-ink-secondary">
              A reviewer is looking at this course. Editing is locked until they respond.
            </p>
          ) : course.status === 'live' ? (
            <a
              href={learnerUrl(`/course/${course.slug}`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-small font-semibold text-brand-fg hover:underline"
            >
              View the live course page <ExternalLink className="size-3.5" />
            </a>
          ) : can('course.submit') ? (
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              icon={Send}
              loading={busy}
              disabled={!checklist.ok}
              onClick={submit}
            >
              Submit for review
            </Button>
          ) : (
            <p className="text-small text-ink-secondary">
              Submitting a course for review is for the owner or a manager.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
