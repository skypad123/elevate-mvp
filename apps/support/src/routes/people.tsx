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
import { errorMessage } from '@elevate/web-ui/portal'
import { Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { type PeopleFilter, usePeople } from '../lib/queries'
import { useUrlSearch } from '../lib/search'

// Teachers are found through the Profiles page: teaching belongs to a profile, not to a person.
const TABS: Array<{ value: string; label: string; filter: PeopleFilter }> = [
  { value: 'all', label: 'Everyone', filter: {} },
  { value: 'learners', label: 'Learners', filter: { role: 'learner' } },
  { value: 'staff', label: 'Staff', filter: { role: 'staff' } },
]

export function People() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'all'
  const { q, setQ, search } = useUrlSearch()
  const active = TABS.find((t) => t.value === tab) ?? TABS[0]!
  const query = usePeople({ ...active.filter, ...(search ? { q: search } : {}) })

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
          type="search"
          aria-label="Search people"
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          wrapperClassName="w-full sm:w-80"
        />
      </div>
      {query.isPending ? (
        <div className="space-y-2">
          {['a', 'b', 'c'].map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState tone="danger" title="Could not load people" body={errorMessage(query.error)} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody here"
          body={search ? 'No one matches that search.' : 'This list is empty for now.'}
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
              <TR key={p.id} className="relative">
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name ?? p.email} url={p.avatarUrl} size="sm" />
                    <div>
                      {/* A real link, stretched over the row. */}
                      <Link
                        to={`/people/${p.id}`}
                        className="block font-semibold text-ink after:absolute after:inset-0 hover:text-brand-fg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-focus"
                      >
                        {p.name ?? p.email}
                      </Link>
                      {p.name ? <p className="text-caption text-ink-tertiary">{p.email}</p> : null}
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
                    // Above the row's link, so each profile opens its own page.
                    <span className="relative z-10 flex flex-wrap gap-x-2 gap-y-1">
                      {p.profiles.map((profile) => (
                        <Link
                          key={profile.id}
                          to={`/profiles/${profile.id}`}
                          className="text-brand-fg hover:underline"
                        >
                          {profile.displayName}
                        </Link>
                      ))}
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
