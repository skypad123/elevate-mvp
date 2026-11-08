import {
  Card,
  CardHeader,
  EmptyState,
  formatDate,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { useAnalytics } from '../lib/queries'

const pct = (value: number | null) => (value === null ? '—' : `${value}%`)

export function InsightsPage() {
  const query = useAnalytics()
  if (query.isPending)
    return (
      <>
        <PageHeader eyebrow="Insights" title="How the funnel is doing" />
        <Skeleton className="h-64 w-full" />
      </>
    )
  if (query.isError)
    return (
      <>
        <PageHeader eyebrow="Insights" title="How the funnel is doing" />
        <EmptyState
          tone="danger"
          title="Could not load insights"
          body={errorMessage(query.error)}
        />
      </>
    )
  const a = query.data
  const maxStarts = Math.max(1, ...a.dropOff.lessons.map((l) => l.starts))
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="How the funnel is doing"
        description={`Completion, drop-off, checkout conversion and time to first payout, from analytics events. Computed ${formatDate(a.generatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Course completion"
          value={pct(a.completion.ratePercent)}
          hint={`${a.completion.completed} of ${a.completion.enrolled} active enrolments finished`}
        />
        <StatCard
          label="Checkout conversion"
          value={pct(a.checkout.ratePercent)}
          hint={`${a.checkout.completed} paid of ${a.checkout.started} checkouts started`}
        />
        <StatCard
          label="Time to first payout"
          value={a.firstPayout.medianDays === null ? '—' : `${a.firstPayout.medianDays} days`}
          hint={`Median from teacher approval · ${a.firstPayout.teachersPaid} teacher${a.firstPayout.teachersPaid === 1 ? '' : 's'} paid`}
        />
        <StatCard
          label="Drop-off lesson"
          value={a.dropOff.dropOffIndex === null ? '—' : `Lesson ${a.dropOff.dropOffIndex + 1}`}
          hint="Largest fall in learners starting a lesson"
        />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card as="section">
          <CardHeader
            title="Completion by course"
            description="Live courses, most enrolled first."
          />
          {a.courses.length === 0 ? (
            <p className="text-small text-ink-secondary">No live courses yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Course</TH>
                  <TH className="text-right">Enrolled</TH>
                  <TH className="text-right">Completed</TH>
                  <TH className="text-right">Rate</TH>
                </TR>
              </THead>
              <TBody>
                {a.courses.map((c) => (
                  <TR key={c.courseId}>
                    <TD className="font-semibold">{c.title}</TD>
                    <TD className="text-right font-mono">{c.enrolled}</TD>
                    <TD className="text-right font-mono">{c.completed}</TD>
                    <TD className="text-right font-mono">{pct(c.ratePercent)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <Card as="section">
          <CardHeader
            title="Learners starting each lesson"
            description="By lesson position across all courses; a steep step is where learners stop."
          />
          {a.dropOff.lessons.length === 0 ? (
            <p className="text-small text-ink-secondary">No lesson activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {a.dropOff.lessons.map((l) => (
                <li key={l.position} className="flex items-center gap-3 text-small">
                  <span className="w-20 shrink-0 text-ink-secondary">Lesson {l.position + 1}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-muted">
                    <span
                      className="block h-full rounded-pill bg-brand"
                      style={{ width: `${Math.round((l.starts / maxStarts) * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 text-right font-mono">{l.starts}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
