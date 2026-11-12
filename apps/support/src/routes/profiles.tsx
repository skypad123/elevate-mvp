import {
  Badge,
  EmptyState,
  formatBps,
  formatDate,
  Input,
  PageHeader,
  Skeleton,
  statusLabel,
  statusTone,
  Table,
  Tabs,
  TabsList,
  TabsTrigger,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { GraduationCap } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { type ProfilesFilter, useProfiles } from '../lib/queries'

const TABS: Array<{ value: string; label: string; filter: ProfilesFilter }> = [
  { value: 'applications', label: 'Applications', filter: { status: 'applied' } },
  { value: 'approved', label: 'Teachers', filter: { status: 'approved' } },
  { value: 'rejected', label: 'Rejected', filter: { status: 'rejected' } },
  { value: 'all', label: 'All profiles', filter: {} },
]

/** Teaching profiles: applications waiting for review, and the profiles that teach. */
export function Profiles() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'applications'
  const [q, setQ] = useState(params.get('q') ?? '')
  const deferredQ = useDeferredValue(q)
  const navigate = useNavigate()
  const active = TABS.find((t) => t.value === tab) ?? TABS[0]!
  const query = useProfiles({
    ...active.filter,
    ...(deferredQ.trim() ? { q: deferredQ.trim() } : {}),
  })

  return (
    <>
      <PageHeader
        eyebrow="Profiles"
        title="Teaching profiles"
        description="Review applications, approve or reject them, and look up any profile that sells courses."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v, ...(q ? { q } : {}) })}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search profile, owner, UEN or legal name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          wrapperClassName="w-72"
        />
      </div>
      {query.isPending ? (
        <div className="space-y-2">
          {['a', 'b', 'c'].map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load profiles"
          body={errorMessage(query.error)}
        />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No profiles here"
          body={deferredQ ? 'No profile matches that search.' : 'This list is empty for now.'}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Profile</TH>
              <TH>Type</TH>
              <TH>Owner</TH>
              <TH>Status</TH>
              <TH>Payments</TH>
              <TH>Commission</TH>
              <TH>Applied</TH>
            </TR>
          </THead>
          <TBody>
            {query.data.items.map((p) => (
              <TR
                key={p.id}
                className="cursor-pointer"
                onClick={() => navigate(`/profiles/${p.id}`)}
              >
                <TD>
                  <p className="font-semibold text-ink">{p.displayName}</p>
                  {p.legalName ? (
                    <p className="text-caption text-ink-tertiary">
                      {p.legalName} · UEN {p.uen}
                    </p>
                  ) : null}
                </TD>
                <TD className="text-ink-secondary">
                  {p.type === 'corporate' ? 'Corporate' : 'Personal'}
                </TD>
                <TD>
                  <p className="text-ink">{p.ownerName ?? '—'}</p>
                  <p className="text-caption text-ink-tertiary">{p.ownerEmail}</p>
                </TD>
                <TD>
                  <Badge tone={statusTone[p.status]}>{statusLabel(p.status)}</Badge>
                </TD>
                <TD>
                  <Badge tone={p.payable ? 'success' : 'neutral'}>
                    {p.payable ? 'Can be paid' : 'Not yet'}
                  </Badge>
                </TD>
                <TD className="font-mono">{formatBps(p.commissionBps)}</TD>
                <TD className="text-ink-secondary">{formatDate(p.appliedAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}
