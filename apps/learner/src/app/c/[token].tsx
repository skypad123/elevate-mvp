import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ShieldCheck, ShieldX } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { CertificateActions, CertificateCard } from '@/components/CertificateCard'
import { useErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import { useCertificateVerification } from '@/lib/learning'
import { usePreferences } from '@/lib/preferences'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, EmptyState, Logo, Screen, Skeleton, Text } from '@/ui'

/** Public verify page: /c/{token}. No session needed, works on a clean logged-out device. */
export default function VerifyCertificate() {
  const { token = '' } = useLocalSearchParams<{ token: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { t, locale } = usePreferences()
  const errorMessage = useErrorMessage()
  const query = useCertificateVerification(token)

  let body: React.ReactNode
  if (query.isPending) {
    body = (
      <View style={{ gap: theme.space[4] }}>
        <Skeleton width="50%" height={28} />
        <Skeleton height={360} radius={theme.radii.card} />
      </View>
    )
  } else if (query.isError) {
    body = (
      <EmptyState
        tone="danger"
        title={t('learnerCertificate.verify.loadFailed.title')}
        body={errorMessage(query.error)}
        action={{ label: t('learnerCommon.error.retry'), onPress: () => query.refetch() }}
      />
    )
  } else if (!query.data.valid) {
    const invalid = query.data
    body = (
      <EmptyState
        icon={ShieldX}
        tone="danger"
        title={t(
          invalid.reason === 'revoked'
            ? 'learnerCertificate.verify.revoked.title'
            : 'learnerCertificate.verify.notFound.title',
        )}
        body={
          invalid.reason === 'revoked'
            ? t('learnerCertificate.verify.revoked.body', {
                date: formatDate(invalid.revokedAt, locale),
              })
            : t('learnerCertificate.verify.notFound.body')
        }
        action={{
          label: t('learnerCertificate.verify.notFound.action'),
          onPress: () => router.replace('/'),
        }}
      />
    )
  } else {
    const { certificate, courseSlug } = query.data
    body = (
      <View style={{ gap: theme.space[5] }}>
        <View style={{ gap: theme.space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <ShieldCheck size={24} color={theme.colors.success} />
            <Text variant="h1">{t('learnerCertificate.verify.title')}</Text>
          </View>
          <Text tone="secondary">
            {t('learnerCertificate.verify.body', { name: certificate.learnerName })}
          </Text>
        </View>
        <CertificateCard certificate={certificate} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
          <CertificateActions certificate={certificate} share={false} />
          <Button
            label={t('learnerCertificate.verify.viewCourse')}
            variant="ghost"
            onPress={() => router.push(`/course/${courseSlug}`)}
          />
        </View>
      </View>
    )
  }

  return (
    <Screen maxWidth={760}>
      <View style={{ gap: theme.space[6] }}>
        <Link href="/" asChild>
          <Pressable style={{ alignSelf: 'flex-start' }} accessibilityRole="link">
            <Logo size="sm" />
          </Pressable>
        </Link>
        {body}
      </View>
    </Screen>
  )
}
