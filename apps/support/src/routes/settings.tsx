import { Card, CardHeader, DescriptionList, PageHeader } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { PreferencesCard, useT } from '@elevate/web-ui/preferences'

export function SettingsPage() {
  const { user } = usePortalAuth()
  const t = useT()
  const role = user?.roles.includes('super_admin') ? t('role.superAdmin') : t('role.supportAgent')
  return (
    <>
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.support.title')}
        description={t('settings.support.description')}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <PreferencesCard />
        <Card as="section" className="self-start">
          <CardHeader title={t('account.title')} />
          <DescriptionList
            items={[
              { label: t('account.email'), value: user?.email },
              { label: t('account.role'), value: role },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
