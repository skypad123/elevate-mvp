import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Award } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { CertificateActions, CertificateCard } from '@/components/CertificateCard'
import { ApiError, useErrorMessage } from '@/lib/api-error'
import { useCertificate } from '@/lib/learning'
import { usePreferences } from '@/lib/preferences'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Screen, Skeleton, Text } from '@/ui'

export default function OwnCertificate() {
  const { enrollmentId = '' } = useLocalSearchParams<{ enrollmentId: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { t } = usePreferences()
  const errorMessage = useErrorMessage()
  const query = useCertificate(enrollmentId)

  let body: React.ReactNode
  if (query.isPending) {
    body = (
      <View style={{ gap: theme.space[4] }}>
        <Skeleton width="60%" height={32} />
        <Skeleton height={360} radius={theme.radii.card} />
      </View>
    )
  } else if (query.isError) {
    const notYet = query.error instanceof ApiError && query.error.status === 404
    body = (
      <EmptyState
        icon={Award}
        tone={notYet ? 'neutral' : 'danger'}
        title={t(
          notYet
            ? 'learnerCertificate.own.notYet.title'
            : 'learnerCertificate.own.loadFailed.title',
        )}
        body={notYet ? t('learnerCertificate.own.notYet.body') : errorMessage(query.error)}
        action={{
          label: t(notYet ? 'learnerCertificate.own.notYet.action' : 'learnerCommon.error.retry'),
          onPress: () => (notYet ? router.replace(`/learn/${enrollmentId}`) : query.refetch()),
        }}
      />
    )
  } else {
    const c = query.data
    body = (
      <View style={{ gap: theme.space[5] }}>
        <View style={{ gap: theme.space[2] }}>
          <Text variant="eyebrow" tone="brand">
            {t('learnerCertificate.own.eyebrow')}
          </Text>
          <Text variant="h1">{t('learnerCertificate.own.title')}</Text>
          <Text tone="secondary">{t('learnerCertificate.own.intro')}</Text>
        </View>
        <CertificateCard certificate={c} />
        {c.learnerName.includes('@') ? (
          <Card style={{ gap: theme.space[3], borderColor: theme.colors.warning }}>
            <Text variant="bodyStrong">{t('learnerCertificate.own.noName.title')}</Text>
            <Text variant="small" tone="secondary">
              {t('learnerCertificate.own.noName.body')}
            </Text>
            <Button
              label={t('learnerCertificate.own.noName.action')}
              variant="secondary"
              size="sm"
              onPress={() => router.push('/profile')}
            />
          </Card>
        ) : null}
        <CertificateActions certificate={c} />
        <Card muted style={{ gap: 4 }}>
          <Text variant="caption" tone="tertiary">
            {t('learnerCertificate.own.verifyLink')}
          </Text>
          <Text variant="small" selectable>
            {c.verifyUrl}
          </Text>
        </Card>
      </View>
    )
  }

  return (
    <Screen maxWidth={760}>
      <View style={{ gap: theme.space[6] }}>
        <Link href={`/learn/${enrollmentId}`} asChild>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          >
            <ArrowLeft size={16} color={theme.colors.inkSecondary} />
            <Text variant="small" tone="secondary">
              {t('learnerCertificate.own.back')}
            </Text>
          </Pressable>
        </Link>
        {body}
      </View>
    </Screen>
  )
}
