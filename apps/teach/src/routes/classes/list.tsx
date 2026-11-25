import type { ClassStatus } from '@elevate/core'
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { CalendarDays, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { formatClassDates, useClasses } from '../../lib/classes'
import { useCurrentProfile } from '../../lib/profile'

export const CLASS_STATUS: Record<ClassStatus, { label: string; tone: 'neutral' | 'success' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'success' },
}

export const DELIVERY_LABEL = { in_person: 'In person', remote: 'Remote' } as const

/**
 * The profile's classes: a course run on set dates for a group of learners. A writer sees only
 * the classes they instruct. The owner and managers create them.
 */
export function ClassesPage() {
  const classes = useClasses()
  const { path, can } = useCurrentProfile()
  const canCreate = can('class.manage')
  const newClass = canCreate ? (
    <Button asChild icon={Plus}>
      <Link to={path('/classes/new')}>New class</Link>
    </Button>
  ) : undefined

  return (
    <>
      <PageHeader
        eyebrow="Classes"
        title="Your classes"
        description="A class runs one of your courses on set dates, with attendance taken at each block. A draft stays private until you publish it."
        actions={newClass}
      />
      {classes.isPending ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : classes.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load classes"
          body={errorMessage(classes.error)}
        />
      ) : classes.data.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No classes yet"
          body={
            canCreate
              ? 'Pick a course on sale, set the days and times, and choose who instructs.'
              : 'A class you are assigned to instruct appears here.'
          }
          action={newClass}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Class</TH>
              <TH>Course</TH>
              <TH>Dates</TH>
              <TH>Instructor</TH>
              <TH>Status</TH>
              <TH className="text-right">Seats</TH>
            </TR>
          </THead>
          <TBody>
            {classes.data.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link
                    to={path(`/classes/${c.id}`)}
                    className="font-semibold text-brand-fg underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="block text-caption text-ink-tertiary">
                    {DELIVERY_LABEL[c.delivery]}
                  </span>
                </TD>
                <TD className="text-ink-secondary">{c.courseTitle}</TD>
                <TD className="whitespace-nowrap text-ink-secondary">
                  {formatClassDates(c.firstBlockStartsAt, c.lastBlockEndsAt, c.timeZone)}
                </TD>
                <TD className="text-ink-secondary">{c.instructor.displayName}</TD>
                <TD>
                  <Badge tone={CLASS_STATUS[c.status].tone}>{CLASS_STATUS[c.status].label}</Badge>
                </TD>
                <TD className="text-right font-mono">
                  {c.enrolledCount} / {c.seats}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}
