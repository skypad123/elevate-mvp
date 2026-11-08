import { Image } from 'expo-image'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, ArrowRight, Award } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Trail } from '@/components/Trail'
import { errorMessage } from '@/lib/api-error'
import { formatMinutes } from '@/lib/format'
import { useEnrollment } from '@/lib/learning'
import { useBreakpoint } from '@/lib/responsive'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, ProgressBar, Screen, Skeleton, Text } from '@/ui'

export default function EnrollmentTrail() {
  const { enrollmentId = '' } = useLocalSearchParams<{ enrollmentId: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { isLg } = useBreakpoint()
  const enrollment = useEnrollment(enrollmentId)

  if (enrollment.isPending) {
    return (
      <Screen maxWidth={880}>
        <View style={{ gap: theme.space[4] }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={32} />
          <Skeleton height={8} />
          <Skeleton height={160} radius={theme.radii.card} />
        </View>
      </Screen>
    )
  }
  if (enrollment.isError) {
    return (
      <Screen maxWidth={880}>
        <EmptyState
          tone="danger"
          title="Could not open this course"
          body={errorMessage(enrollment.error)}
          action={{ label: 'My Learning', onPress: () => router.replace('/learning') }}
        />
      </Screen>
    )
  }
  const e = enrollment.data
  const resume = e.progress.resume
  const goTo = (lessonId: string, artefactId?: string) =>
    router.push({
      pathname: '/learn/[enrollmentId]/lesson/[lessonId]',
      params: { enrollmentId, lessonId, ...(artefactId ? { artefact: artefactId } : {}) },
    })

  return (
    <Screen maxWidth={880}>
      <View style={{ gap: theme.space[6] }}>
        <Link href="/learning" asChild>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          >
            <ArrowLeft size={16} color={theme.colors.inkSecondary} />
            <Text variant="small" tone="secondary">
              My Learning
            </Text>
          </Pressable>
        </Link>

        <View
          style={{
            flexDirection: isLg ? 'row' : 'column',
            gap: theme.space[5],
            alignItems: isLg ? 'center' : 'stretch',
          }}
        >
          <View
            style={{
              width: isLg ? 200 : '100%',
              aspectRatio: 16 / 9,
              borderRadius: theme.radii.card,
              overflow: 'hidden',
              backgroundColor: theme.colors.surfaceSunken,
            }}
          >
            {e.course.thumbnailUrl ? (
              <Image
                source={{ uri: e.course.thumbnailUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : null}
          </View>
          <View style={{ flex: 1, gap: theme.space[2] }}>
            <Text variant="eyebrow" tone="tertiary">
              {e.course.teacherName}
            </Text>
            <Text variant="h1">{e.course.title}</Text>
            <ProgressBar percent={e.progress.percent} />
            <Text variant="small" tone="secondary">
              {e.progress.percent}% · {e.progress.completedLessons} of {e.progress.totalLessons}{' '}
              lessons complete
            </Text>
          </View>
        </View>

        {e.progress.isComplete ? (
          <Card style={{ gap: theme.space[3], borderColor: theme.colors.brand }} elevated>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
              <Award size={22} color={theme.colors.brand} />
              <Text variant="h2">Course complete</Text>
            </View>
            <Text tone="secondary">
              {e.certificateId
                ? 'You finished every lesson and passed every quiz. Your certificate is ready to download and share.'
                : 'You finished every lesson and passed every quiz. Your certificate is being prepared and will appear here.'}
            </Text>
            {e.certificateId ? (
              <Button
                label="View certificate"
                variant="primary"
                onPress={() => router.push(`/learn/${enrollmentId}/certificate`)}
              />
            ) : null}
          </Card>
        ) : resume ? (
          <Card
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[4],
              borderColor: theme.colors.accent,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="eyebrow" tone="accent">
                Up next
              </Text>
              <Text variant="h3">{e.lessons.find((l) => l.id === resume.lessonId)?.title}</Text>
              <Text variant="small" tone="secondary" numberOfLines={1}>
                {
                  e.lessons
                    .find((l) => l.id === resume.lessonId)
                    ?.artefacts.find((a) => a.id === resume.artefactId)?.title
                }
              </Text>
            </View>
            <Button
              label={e.progress.percent > 0 ? 'Resume' : 'Start'}
              variant="accent"
              iconRight={ArrowRight}
              onPress={() => goTo(resume.lessonId, resume.artefactId)}
            />
          </Card>
        ) : null}

        <View style={{ gap: theme.space[4] }}>
          <Text variant="h2">Lessons</Text>
          <Trail
            items={e.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              summary: l.summary,
              status: l.status,
              meta: `${l.artefacts.length} item${l.artefacts.length === 1 ? '' : 's'}${formatMinutes(l.artefacts.reduce((n, a) => n + (a.durationSeconds ?? 0), 0)) ? ` · ${formatMinutes(l.artefacts.reduce((n, a) => n + (a.durationSeconds ?? 0), 0))}` : ''}${l.status === 'in_progress' ? ` · ${l.percent}%` : ''}`,
              requires: l.status === 'locked' ? l.blockedBy : [],
            }))}
            onPress={(item) => goTo(item.id)}
          />
        </View>
      </View>
    </Screen>
  )
}
