import { categoryLabel, formatSgd } from '@elevate/core'
import { Image } from 'expo-image'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ArrowLeft, ArrowRight, Clock, Layers, Users } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { RichText } from '@/components/RichText'
import { Trail } from '@/components/Trail'
import { errorMessage } from '@/lib/api-error'
import { startCheckout, useCourseDetail } from '@/lib/catalog'
import { formatMinutes } from '@/lib/format'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'
import { webBaseUrl } from '@/lib/web-url'
import { useTheme } from '@/theme/ThemeProvider'
import { Avatar, Badge, Button, Card, EmptyState, Screen, Skeleton, Text } from '@/ui'

export default function CourseDetail() {
  const { slug = '', checkout } = useLocalSearchParams<{ slug: string; checkout?: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { isWideWeb, isLg } = useBreakpoint()
  const { isSignedIn } = useSession()
  const course = useCourseDetail(slug)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (course.isPending) {
    return (
      <Screen bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
        <View style={{ gap: theme.space[4] }}>
          <Skeleton height={isLg ? 360 : 220} radius={theme.radii.card} />
          <Skeleton width="60%" height={32} />
          <Skeleton width="90%" height={18} />
        </View>
      </Screen>
    )
  }
  if (course.isError) {
    return (
      <Screen bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
        <EmptyState
          tone="danger"
          title="Course not found"
          body={errorMessage(course.error)}
          action={{ label: 'Back to Explore', onPress: () => router.replace('/') }}
        />
      </Screen>
    )
  }
  const c = course.data
  const enrolled = c.viewer?.status === 'active'
  const lessonTitle = new Map(c.lessons.map((l) => [l.id, l.title]))

  async function enrol() {
    setError(null)
    if (enrolled && c.viewer) {
      router.push(`/learn/${c.viewer.enrollmentId}`)
      return
    }
    if (!isSignedIn) {
      router.push({ pathname: '/sign-in', params: { redirect: `/course/${c.slug}` } })
      return
    }
    if (c.priceCents === 0) {
      setBusy(true)
      try {
        const result = await startCheckout(c.id)
        if (result.kind === 'enrolled') {
          await course.refetch()
          router.push(`/learn/${result.enrollmentId}`)
        }
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
      return
    }
    if (Platform.OS === 'web') {
      router.push(`/checkout/${c.id}`)
      return
    }
    await WebBrowser.openBrowserAsync(`${webBaseUrl()}/course/${c.slug}`)
  }

  const ctaLabel = enrolled
    ? 'Continue learning'
    : c.priceCents === 0
      ? 'Enrol for free'
      : Platform.OS === 'web'
        ? `Enrol · ${formatSgd(c.priceCents)}`
        : 'Enrol on the web'

  const cta = (
    <Card style={{ gap: theme.space[4] }} elevated>
      <View style={{ gap: 4 }}>
        <Text variant="eyebrow" tone="tertiary">
          {enrolled ? 'You are enrolled' : 'One payment, lifetime access'}
        </Text>
        <Text variant="display" style={{ fontSize: 36, lineHeight: 40 }}>
          {formatSgd(c.priceCents, { showFree: true })}
        </Text>
        {!enrolled && c.priceCents > 0 ? (
          <Text variant="small" tone="secondary">
            All fees included. Secure payment by Stripe.
          </Text>
        ) : null}
      </View>
      <Button
        label={ctaLabel}
        variant={enrolled ? 'primary' : 'accent'}
        size="lg"
        iconRight={ArrowRight}
        fullWidth
        loading={busy}
        onPress={enrol}
      />
      {checkout === 'cancelled' && !enrolled ? (
        <Text variant="small" tone="warning">
          Payment was cancelled. You can try again whenever you like.
        </Text>
      ) : null}
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}
      {Platform.OS !== 'web' && !enrolled && c.priceCents > 0 ? (
        <Text variant="caption" tone="tertiary">
          Checkout opens in your browser; your enrolment appears here afterwards.
        </Text>
      ) : null}
      <View style={{ gap: theme.space[2] }}>
        {[
          {
            icon: Layers,
            text: `${c.lessonCount} lesson${c.lessonCount === 1 ? '' : 's'} · ${c.artefactCount} items`,
          },
          {
            icon: Clock,
            text: c.durationSeconds ? `About ${formatMinutes(c.durationSeconds)}` : 'Self-paced',
          },
          { icon: Users, text: `${c.enrolCount} enrolled` },
        ].map((row) => (
          <View
            key={row.text}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}
          >
            <row.icon size={16} color={theme.colors.inkTertiary} />
            <Text variant="small" tone="secondary">
              {row.text}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  )

  return (
    <Screen bottomInset={isWideWeb ? 0 : TAB_BAR_HEIGHT}>
      <View style={{ gap: theme.space[6] }}>
        <Link href="/" asChild>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          >
            <ArrowLeft size={16} color={theme.colors.inkSecondary} />
            <Text variant="small" tone="secondary">
              Explore
            </Text>
          </Pressable>
        </Link>

        <View style={{ flexDirection: isLg ? 'row' : 'column', gap: theme.space[8] }}>
          <View style={{ flex: 1, gap: theme.space[6] }}>
            <View
              style={{
                aspectRatio: 16 / 9,
                borderRadius: theme.radii.card,
                overflow: 'hidden',
                backgroundColor: theme.colors.surfaceSunken,
              }}
            >
              {c.thumbnailUrl ? (
                <Image
                  source={{ uri: c.thumbnailUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                />
              ) : null}
            </View>
            <View style={{ gap: theme.space[3] }}>
              <View style={{ flexDirection: 'row', gap: theme.space[2], alignItems: 'center' }}>
                <Badge label={categoryLabel(c.category)} tone="brand" />
                {enrolled ? <Badge label="Enrolled" tone="success" /> : null}
              </View>
              <Text variant={isLg ? 'display' : 'h1'}>{c.title}</Text>
              {c.summary ? (
                <Text variant="bodyLg" tone="secondary">
                  {c.summary}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
                <Avatar name={c.teacher.displayName} url={c.teacher.avatarUrl} size={36} />
                <View>
                  <Text variant="smallStrong">{c.teacher.displayName}</Text>
                  {c.teacher.headline ? (
                    <Text variant="caption" tone="tertiary">
                      {c.teacher.headline}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {!isLg ? cta : null}

            <View style={{ gap: theme.space[4] }}>
              <Text variant="h2">What you will learn</Text>
              <Trail
                items={c.lessons.map((l) => ({
                  id: l.id,
                  title: l.title,
                  summary: l.summary,
                  meta: `${l.artefacts.length} item${l.artefacts.length === 1 ? '' : 's'}${formatMinutes(l.artefacts.reduce((n, a) => n + (a.durationSeconds ?? 0), 0)) ? ` · ${formatMinutes(l.artefacts.reduce((n, a) => n + (a.durationSeconds ?? 0), 0))}` : ''}`,
                  requires: l.prerequisiteIds
                    .map((id) => lessonTitle.get(id) ?? '')
                    .filter(Boolean),
                }))}
              />
            </View>

            {c.descriptionJson ? (
              <View style={{ gap: theme.space[4] }}>
                <Text variant="h2">About this course</Text>
                <RichText doc={c.descriptionJson} />
              </View>
            ) : null}

            <Card style={{ gap: theme.space[3] }} muted>
              <Text variant="eyebrow" tone="tertiary">
                Your teacher
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
                <Avatar name={c.teacher.displayName} url={c.teacher.avatarUrl} size={56} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{c.teacher.displayName}</Text>
                  {c.teacher.headline ? <Text tone="secondary">{c.teacher.headline}</Text> : null}
                </View>
              </View>
              {c.teacher.bio ? <Text tone="secondary">{c.teacher.bio}</Text> : null}
            </Card>
          </View>
          {isLg ? <View style={{ width: 340 }}>{cta}</View> : null}
        </View>
      </View>
    </Screen>
  )
}
