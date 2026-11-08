import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ShieldCheck, ShieldX } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { CertificateActions, CertificateCard } from '@/components/CertificateCard'
import { errorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import { useCertificateVerification } from '@/lib/learning'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, EmptyState, Logo, Screen, Skeleton, Text } from '@/ui'

/** Public verify page: /c/{token}. No session needed, works on a clean logged-out device. */
export default function VerifyCertificate() {
  const { token = '' } = useLocalSearchParams<{ token: string }>()
  const theme = useTheme()
  const router = useRouter()
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
        title="Could not check this certificate"
        body={errorMessage(query.error)}
        action={{ label: 'Try again', onPress: () => query.refetch() }}
      />
    )
  } else if (!query.data.valid) {
    const invalid = query.data
    body = (
      <EmptyState
        icon={ShieldX}
        tone="danger"
        title={invalid.reason === 'revoked' ? 'Certificate revoked' : 'Certificate not found'}
        body={
          invalid.reason === 'revoked'
            ? `This certificate was withdrawn by Elevate on ${formatDate(invalid.revokedAt)} and is no longer valid.`
            : 'No certificate matches this link. Check the address, or ask the holder for the link printed on their PDF.'
        }
        action={{ label: 'Explore courses', onPress: () => router.replace('/') }}
      />
    )
  } else {
    const { certificate, courseSlug } = query.data
    body = (
      <View style={{ gap: theme.space[5] }}>
        <View style={{ gap: theme.space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <ShieldCheck size={24} color={theme.colors.success} />
            <Text variant="h1">Verified certificate</Text>
          </View>
          <Text tone="secondary">
            Elevate confirms this certificate is genuine: it was issued when{' '}
            {certificate.learnerName} completed every lesson and passed every quiz in this course.
            Anyone with this link can check it, no account needed.
          </Text>
        </View>
        <CertificateCard certificate={certificate} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
          <CertificateActions certificate={certificate} share={false} />
          <Button
            label="View the course"
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
