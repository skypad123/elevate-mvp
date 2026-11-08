import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Award } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { CertificateActions, CertificateCard } from '@/components/CertificateCard'
import { ApiError, errorMessage } from '@/lib/api-error'
import { useCertificate } from '@/lib/learning'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Screen, Skeleton, Text } from '@/ui'

export default function OwnCertificate() {
  const { enrollmentId = '' } = useLocalSearchParams<{ enrollmentId: string }>()
  const theme = useTheme()
  const router = useRouter()
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
        title={
          notYet ? 'Finish the course to earn your certificate' : 'Could not load your certificate'
        }
        body={
          notYet
            ? 'Complete every lesson and pass every quiz. Your certificate is issued the moment you do.'
            : errorMessage(query.error)
        }
        action={{
          label: notYet ? 'Back to the course' : 'Try again',
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
            Your certificate
          </Text>
          <Text variant="h1">You did it.</Text>
          <Text tone="secondary">
            Download the PDF or share the verify link. Anyone can open the link to confirm your
            certificate, no sign-in needed; it is also printed on the PDF with a QR code.
          </Text>
        </View>
        <CertificateCard certificate={c} />
        {c.learnerName.includes('@') ? (
          <Card style={{ gap: theme.space[3], borderColor: theme.colors.warning }}>
            <Text variant="bodyStrong">Put your name on it</Text>
            <Text variant="small" tone="secondary">
              Your profile has no name yet, so the certificate shows your email. Add your name under
              Profile and it is reprinted here automatically, same verify link.
            </Text>
            <Button
              label="Go to Profile"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/profile')}
            />
          </Card>
        ) : null}
        <CertificateActions certificate={c} />
        <Card muted style={{ gap: 4 }}>
          <Text variant="caption" tone="tertiary">
            Verify link
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
              Back to course
            </Text>
          </Pressable>
        </Link>
        {body}
      </View>
    </Screen>
  )
}
