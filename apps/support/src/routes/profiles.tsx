import {
  Badge,
  EmptyState,
  formatBps,
  Input,
  PageHeader,
  Skeleton,
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
import { type MessageKey, useFormatDate, useT } from '@elevate/web-ui/preferences'
import { GraduationCap } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { type ProfilesFilter, useProfiles } from '../lib/queries'

const TABS: Array<{ value: string; labelKey: MessageKey; filter: ProfilesFilter }> = [
  { value: 'applications', labelKey: 'profiles.tab.applications', filter: { status: 'applied' } },
  { value: 'approved', labelKey: 'profiles.tab.teachers', filter: { status: 'approved' } },
  { value: 'rejected', labelKey: 'profiles.tab.rejected', filter: { status: 'rejected' } },
  { value: 'all', labelKey: 'profiles.tab.all', filter: {} },
]

/** Teaching profiles: applications waiting for review, and the profiles that teach. */
export function Profiles() {
  const t = useT()
  const formatDate = useFormatDate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'applications'
  const [q, setQ] = useState(params.get('q') ?? '')
  const deferredQ = useDeferredValue(q)
  const navigate = useNavigate()
  const active = TABS.find((item) => item.value === tab) ?? TABS[0]!
  const query = useProfiles({
    ...active.filter,
    ...(deferredQ.trim() ? { q: deferredQ.trim() } : {}),
  })

  return (
    <>
      <PageHeader
        eyebrow={t('profiles.eyebrow')}
        title={t('profiles.title')}
        description={t('profiles.description')}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v, ...(q ? { q } : {}) })}>
          <TabsList>
            {TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {t(item.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          placeholder={t('profiles.search.placeholder')}
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
          title={t('profiles.loadError')}
          body={errorMessage(query.error)}
        />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={t('profiles.empty.title')}
          body={deferredQ ? t('profiles.empty.search') : t('profiles.empty.list')}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('profiles.column.profile')}</TH>
              <TH>{t('profiles.column.type')}</TH>
              <TH>{t('profileRole.owner')}</TH>
              <TH>{t('common.status')}</TH>
              <TH>{t('profiles.column.payments')}</TH>
              <TH>{t('account.commission')}</TH>
              <TH>{t('profiles.column.applied')}</TH>
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
                      {p.legalName} · {t('company.uenValue', { uen: p.uen ?? '' })}
                    </p>
                  ) : null}
                </TD>
                <TD className="text-ink-secondary">{t(`profileType.${p.type}`)}</TD>
                <TD>
                  <p className="text-ink">{p.ownerName ?? '—'}</p>
                  <p className="text-caption text-ink-tertiary">{p.ownerEmail}</p>
                </TD>
                <TD>
                  <Badge tone={statusTone[p.status]}>{t(`status.profile.${p.status}`)}</Badge>
                </TD>
                <TD>
                  <Badge tone={p.payable ? 'success' : 'neutral'}>
                    {p.payable ? t('profiles.payable.yes') : t('profiles.payable.no')}
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
