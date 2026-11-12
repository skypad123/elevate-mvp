import {
  Avatar,
  Badge,
  EmptyState,
  formatDate,
  Input,
  PageHeader,
  Skeleton,
  statusLabel,
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
import { Users } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { type PeopleFilter, usePeople } from '../lib/queries'

// Teachers are found through the Profiles page: teaching belongs to a profile, not to a person.
const TABS: Array<{ value: string; label: string; filter: PeopleFilter }> = [
  { value: 'all', label: 'Everyone', filter: {} },
  { value: 'learners', label: 'Learners', filter: { role: 'learner' } },
  { value: 'staff', label: 'Staff', filter: { role: 'staff' } },
]

export function People() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'all'
  const [q, setQ] = useState(params.get('q') ?? '')
  const deferredQ = useDeferredValue(q)
  const navigate = useNavigate()
  const active = TABS.find((t) => t.value === tab) ?? TABS[0]!
  const query = usePeople({
    ...active.filter,
    ...(deferredQ.trim() ? { q: deferredQ.trim() } : {}),
  })

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="People"
        description="Look up anyone with an account and manage staff access. Teacher applications are under Profiles."
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
          placeholder="Search name or email"
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
        <EmptyState tone="danger" title="Could not load people" body={String(query.error)} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody here"
          body={deferredQ ? 'No one matches that search.' : 'This list is empty for now.'}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Person</TH>
              <TH>Roles</TH>
              <TH>Teaching profiles</TH>
              <TH>Joined</TH>
            </TR>
          </THead>
          <TBody>
            {query.data.items.map((p) => (
              <TR key={p.id} className="cursor-pointer" onClick={() => navigate(`/people/${p.id}`)}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name ?? p.email} url={p.avatarUrl} size="sm" />
                    <div>
                      <p className="font-semibold text-ink">{p.name ?? '—'}</p>
                      <p className="text-caption text-ink-tertiary">{p.email}</p>
                    </div>
                  </div>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {p.roles.length === 0 ? (
                      <Badge>Learner</Badge>
                    ) : (
                      p.roles.map((r) => (
                        <Badge key={r} tone="info">
                          {statusLabel(r)}
                        </Badge>
                      ))
                    )}
                  </div>
                </TD>
                <TD>
                  {p.profiles.length === 0 ? (
                    <span className="text-ink-tertiary">—</span>
                  ) : (
                    <span className="text-ink-secondary">
                      {p.profiles.map((profile) => profile.displayName).join(', ')}
                    </span>
                  )}
                </TD>
                <TD className="text-ink-secondary">{formatDate(p.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}
