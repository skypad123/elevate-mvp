import { formatSgd } from '@elevate/core'
import { Image } from 'expo-image'
import { Link, useRouter } from 'expo-router'
import { ArrowRight, GraduationCap } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { useErrorMessage } from '@/lib/api-error'
import { useEnrollments } from '@/lib/catalog'
import { formatDate } from '@/lib/format'
import { usePreferences } from '@/lib/preferences'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Badge, Button, Card, EmptyState, Grid, ProgressBar, Screen, Skeleton, Text } from '@/ui'

export default function Learning() {
  const theme = useTheme()
  const router = useRouter()
  const { isWideWeb, isMd } = useBreakpoint()
  const { user, isSignedIn } = useSession()
  const { t, locale } = usePreferences()
  const errorMessage = useErrorMessage()
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
            {t('learnerLearn.learning.eyebrow')}
          </Text>
          <Text variant="h1">
            {user?.name
              ? t('learnerLearn.learning.welcomeName', { name: user.name.split(' ')[0] ?? '' })
              : t('learnerLearn.learning.welcome')}
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
            title={t('learnerLearn.learning.loadError')}
            body={errorMessage(enrollments.error)}
            action={{ label: t('learnerCommon.error.retry'), onPress: () => enrollments.refetch() }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={t('learnerLearn.learning.empty.title')}
            body={t('learnerLearn.learning.empty.body')}
            action={{
              label: t('learnerLearn.learning.empty.action'),
              onPress: () => router.push('/'),
            }}
          />
        ) : (
          <>
            {continueItem ? (
              <Card style={{ gap: theme.space[3], borderColor: theme.colors.brand }} elevated>
                <Text variant="eyebrow" tone="brand">
                  {t('learnerLearn.learning.continue')}
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
                    {t(
                      continueItem.progress.totalArtefacts === 1
                        ? 'learnerLearn.learning.progress.one'
                        : 'learnerLearn.learning.progress.other',
                      {
                        completed: continueItem.progress.completedArtefacts,
                        total: continueItem.progress.totalArtefacts,
                        percent: continueItem.progress.percent,
                      },
                    )}
                  </Text>
                  <Button
                    label={t('learnerLearn.resume')}
                    variant="accent"
                    iconRight={ArrowRight}
                    onPress={() => router.push(`/learn/${continueItem.id}`)}
                  />
                </View>
              </Card>
            ) : null}
            <Grid columns={isMd ? 2 : 1} gap={theme.space[4]}>
              {items.map((e) => (
                <Link key={e.id} href={`/learn/${e.id}`} asChild>
                  <Pressable>
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
                            <Badge label={t('learnerLearn.completed')} tone="success" />
                          ) : e.status !== 'active' ? (
                            <Badge
                              label={t(`learnerLearn.enrollmentStatus.${e.status}`)}
                              tone="danger"
                            />
                          ) : null}
                        </View>
                        <Text variant="small" tone="secondary">
                          {t('learnerLearn.learning.byline', {
                            teacher: e.course.teacherName,
                            date: formatDate(e.enrolledAt, locale),
                          })}
                        </Text>
                        <ProgressBar percent={e.progress.percent} />
                        <Text variant="caption" tone="tertiary">
                          {t(
                            e.certificateId
                              ? 'learnerLearn.learning.summaryCertified'
                              : 'learnerLearn.learning.summary',
                            {
                              percent: e.progress.percent,
                              price:
                                e.course.priceCents === 0
                                  ? t('learnerCommon.price.free')
                                  : formatSgd(e.course.priceCents),
                            },
                          )}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                </Link>
              ))}
            </Grid>
          </>
        )}
      </View>
    </Screen>
  )
}
