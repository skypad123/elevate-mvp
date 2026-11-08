import {
  Button,
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
import { ScrollText } from 'lucide-react'
import { useAuditLog } from '../lib/queries'

const dateTime: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}

export function AuditLogPage() {
  const query = useAuditLog()
  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <>
      <PageHeader
        eyebrow="Audit log"
        title="Who did what"
        description="Approvals, rejections, refunds, certificates and course completions, newest first."
      />
      {query.isPending ? (
        <div className="space-y-2">
          {['a', 'b', 'c', 'd'].map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load the audit log"
          body={errorMessage(query.error)}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing logged yet" />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>Details</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((entry) => (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap text-ink-secondary">
                    {formatDate(entry.createdAt, dateTime)}
                  </TD>
                  <TD className="font-mono text-caption">
                    {entry.actorEmail ?? <span className="text-ink-tertiary">system</span>}
                  </TD>
                  <TD className="font-mono text-caption font-semibold">{entry.action}</TD>
                  <TD className="font-mono text-caption text-ink-secondary">
                    {entry.entityType}
                    {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}
                  </TD>
                  <TD className="max-w-md truncate font-mono text-caption text-ink-secondary">
                    {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {query.hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                loading={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
