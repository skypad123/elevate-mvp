import { formatSgd } from '@elevate/core'
import {
  Badge,
  EmptyState,
  formatDate,
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
import { ClipboardCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useReviewQueue } from '../lib/queries'

export function ReviewQueue() {
  const queue = useReviewQueue()
  const navigate = useNavigate()
  return (
    <>
      <PageHeader
        eyebrow="Review queue"
        title="Courses awaiting approval"
        description="Oldest submissions first. Approval is the only path to live."
      />
      {queue.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : queue.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load the queue"
          body={errorMessage(queue.error)}
        />
      ) : queue.data.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Queue is clear"
          body="Nothing is waiting for review right now."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Course</TH>
              <TH>Teacher</TH>
              <TH>Content</TH>
              <TH>Price</TH>
              <TH>Submitted</TH>
            </TR>
          </THead>
          <TBody>
            {queue.data.map((c) => (
              <TR key={c.id} className="cursor-pointer" onClick={() => navigate(`/review/${c.id}`)}>
                <TD>
                  <div className="flex items-center gap-3">
                    {c.thumbnailUrl ? (
                      <img
                        src={c.thumbnailUrl}
                        alt=""
                        className="h-10 w-14 rounded-sm object-cover"
                      />
                    ) : (
                      <div className="h-10 w-14 rounded-sm bg-surface-sunken" />
                    )}
                    <div>
                      <p className="font-semibold text-ink">{c.title}</p>
                      <p className="text-caption text-ink-tertiary">{c.category}</p>
                    </div>
                  </div>
                </TD>
                <TD>
                  <p className="text-ink">{c.teacherName}</p>
                  <p className="text-caption text-ink-tertiary">{c.teacherEmail}</p>
                </TD>
                <TD className="text-ink-secondary">
                  {c.lessonCount} lessons · {c.artefactCount} items
                </TD>
                <TD className="font-mono">{formatSgd(c.priceCents, { showFree: true })}</TD>
                <TD>
                  <Badge tone="warning">{formatDate(c.submittedAt)}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}
