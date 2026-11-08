import { formatSgd } from '@elevate/core'
import { Image } from 'expo-image'
import { Link, useRouter } from 'expo-router'
import { ArrowRight, GraduationCap } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { errorMessage } from '@/lib/api-error'
import { useEnrollments } from '@/lib/catalog'
import { formatDate } from '@/lib/format'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Badge, Button, Card, EmptyState, ProgressBar, Screen, Skeleton, Text } from '@/ui'

export default function Learning() {
  const theme = useTheme()
  const router = useRouter()
  const { isWideWeb, isMd } = useBreakpoint()
  const { user, isSignedIn } = useSession()
  const enrollments = useEnrollments(isSignedIn)
  const items = enrollments.data ?? []
  const continueItem =
    items.find(
      (e) => e.status === 'active' && !e.completedAt && e.progress.completedArtefacts > 0,
    ) ?? items.find((e) => e.status === 'active' && !e.completedAt)

  return (
    <Screen bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
      <View style={{ gap: theme.space[6] }}>
        <View style={{ gap: theme.space[2] }}>
          <Text variant="eyebrow" tone="tertiary">
            My Learning
          </Text>
          <Text variant="h1">
            {user?.name ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Welcome back.'}
          </Text>
        </View>

        {enrollments.isPending ? (
          <View style={{ gap: theme.space[4] }}>
            <Skeleton height={120} radius={theme.radii.card} />
            <Skeleton height={120} radius={theme.radii.card} />
          </View>
        ) : enrollments.isError ? (
          <EmptyState
            tone="danger"
            title="Could not load your courses"
            body={errorMessage(enrollments.error)}
            action={{ label: 'Try again', onPress: () => enrollments.refetch() }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nothing in progress yet"
            body="Courses you enrol in appear here with your progress and certificates."
            action={{ label: 'Explore courses', onPress: () => router.push('/') }}
          />
        ) : (
          <>
            {continueItem ? (
              <Card style={{ gap: theme.space[3], borderColor: theme.colors.brand }} elevated>
                <Text variant="eyebrow" tone="brand">
                  Continue
                </Text>
                <Text variant="h2">{continueItem.course.title}</Text>
                <ProgressBar percent={continueItem.progress.percent} />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text variant="small" tone="secondary">
                    {continueItem.progress.completedArtefacts} of{' '}
                    {continueItem.progress.totalArtefacts} items · {continueItem.progress.percent}%
                  </Text>
                  <Button
                    label="Resume"
                    variant="accent"
                    iconRight={ArrowRight}
                    onPress={() => router.push(`/learn/${continueItem.id}`)}
                  />
                </View>
              </Card>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[4] }}>
              {items.map((e) => (
                <Link key={e.id} href={`/learn/${e.id}`} asChild>
                  <Pressable style={{ flexBasis: isMd ? '48%' : '100%', flexGrow: 1 }}>
                    <Card padded={false} style={{ flexDirection: 'row' }}>
                      <View style={{ width: 120, backgroundColor: theme.colors.surfaceSunken }}>
                        {e.course.thumbnailUrl ? (
                          <Image
                            source={{ uri: e.course.thumbnailUrl }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                        ) : null}
                      </View>
                      <View style={{ flex: 1, padding: theme.space[4], gap: theme.space[2] }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            gap: theme.space[2],
                          }}
                        >
                          <Text variant="h3" numberOfLines={2} style={{ flex: 1 }}>
                            {e.course.title}
                          </Text>
                          {e.completedAt ? (
                            <Badge label="Completed" tone="success" />
                          ) : e.status !== 'active' ? (
                            <Badge label={e.status} tone="danger" />
                          ) : null}
                        </View>
                        <Text variant="small" tone="secondary">
                          {e.course.teacherName} · enrolled {formatDate(e.enrolledAt)}
                        </Text>
                        <ProgressBar percent={e.progress.percent} />
                        <Text variant="caption" tone="tertiary">
                          {e.progress.percent}% ·{' '}
                          {e.course.priceCents === 0 ? 'Free' : formatSgd(e.course.priceCents)}
                          {e.certificateId ? ' · Certificate earned' : ''}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                </Link>
              ))}
            </View>
          </>
        )}
      </View>
    </Screen>
  )
}
