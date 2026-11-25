import type { SupportClassSummary } from '@elevate/core'
import {
  Badge,
  EmptyState,
  formatDate,
  Input,
  PageHeader,
  Skeleton,
  statusLabel,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { CalendarDays, Search } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useClassSearch } from '../lib/queries'
import { useUrlSearch } from '../lib/search'

/** A day in the class's own time zone, so Support reads the dates the instructor set. */
export function classDay(iso: string | null, timeZone: string): string {
  return formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric', timeZone })
}

export function dateRange(
  c: Pick<SupportClassSummary, 'firstBlockStartsAt' | 'lastBlockEndsAt' | 'timeZone'>,
) {
  if (!c.firstBlockStartsAt) return 'No blocks'
  const first = classDay(c.firstBlockStartsAt, c.timeZone)
  const last = classDay(c.lastBlockEndsAt, c.timeZone)
  return first === last ? first : `${first} – ${last}`
}

export const deliveryLabel = { in_person: 'In person', remote: 'Remote' } as const

/** Scheduled classes, found by profile name, class name or a learner's email. Read only. */
export function Classes() {
  const { q, setQ, search } = useUrlSearch()
  const location = useLocation()
  const query = useClassSearch(search)

  return (
    <>
      <PageHeader
        eyebrow="Classes"
        title="Scheduled classes"
        description="Find a class to read its blocks and attendance. Nothing here changes a class or its record."
      />
      <div className="mb-4">
        <Input
          type="search"
          aria-label="Search classes"
          placeholder="Profile name, class name or learner email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          wrapperClassName="w-full sm:w-96"
        />
      </div>
      {!search ? (
        <EmptyState
          icon={Search}
          title="Search for a class"
          body="Type a profile name, a class name or a learner's email address."
        />
      ) : query.isPending ? (
        <div className="space-y-2">
          {['a', 'b', 'c'].map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState tone="danger" title="Could not load classes" body={errorMessage(query.error)} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No classes" body="Nothing matches that search." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Class</TH>
              <TH>Profile</TH>
              <TH>Delivery</TH>
              <TH>Dates</TH>
              <TH>Instructor</TH>
              <TH className="text-right">Enrolled</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {query.data.map((c) => (
              <TR key={c.id} className="relative">
                <TD>
                  {/* A real link, stretched over the row: keyboard, screen readers and new tabs work. */}
                  <Link
                    to={`/classes/${c.id}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                    className="font-semibold text-ink after:absolute after:inset-0 hover:text-brand-fg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-focus"
                  >
                    {c.name}
                  </Link>
                  <p className="text-caption text-ink-tertiary">{c.courseTitle}</p>
                </TD>
                <TD className="text-ink-secondary">{c.profile.displayName}</TD>
                <TD className="text-ink-secondary">{deliveryLabel[c.delivery]}</TD>
                <TD className="whitespace-nowrap text-ink-secondary">{dateRange(c)}</TD>
                <TD className="text-ink-secondary">{c.instructor.displayName}</TD>
                <TD className="text-right font-mono">
                  {c.enrolledCount} / {c.seats}
                </TD>
                <TD>
                  <Badge tone={c.status === 'published' ? 'success' : 'neutral'}>
                    {statusLabel(c.status)}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}
