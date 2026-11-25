import { formatSgd } from '@elevate/core'
import { Image } from 'expo-image'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ArrowLeft, ArrowRight, Clock, Layers, Users } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { ClassChoice } from '@/components/ClassChoice'
import { TAB_BAR_HEIGHT } from '@/components/PillTabBar'
import { RichText } from '@/components/RichText'
import { Trail } from '@/components/Trail'
import { useErrorMessage } from '@/lib/api-error'
import { startCheckout, useCourseDetail } from '@/lib/catalog'
import { categoryName } from '@/lib/categories'
import { formatMinutes } from '@/lib/format'
import { usePreferences } from '@/lib/preferences'
import { useBreakpoint } from '@/lib/responsive'
import { useSession } from '@/lib/session'
import { webBaseUrl } from '@/lib/web-url'
import { useTheme } from '@/theme/ThemeProvider'
import { Avatar, Badge, Button, Card, EmptyState, Screen, Skeleton, Text } from '@/ui'

export default function CourseDetail() {
  const {
    slug = '',
    checkout,
    class: chosenClassId,
  } = useLocalSearchParams<{ slug: string; checkout?: string; class?: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { isWideWeb, isLg } = useBreakpoint()
  const { isSignedIn } = useSession()
  const { locale, t } = usePreferences()
  const wordError = useErrorMessage()
  const course = useCourseDetail(slug)
  const [busy, setBusy] = useState(false)
  // The error object, worded at render so a language switch rewords it
  const [error, setError] = useState<unknown>(null)

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
          title={t('learnerCourse.notFound.title')}
          body={wordError(course.error)}
          action={{ label: t('learnerCourse.notFound.back'), onPress: () => router.replace('/') }}
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
        const result = await startCheckout(c.id, { locale })
        if (result.kind === 'enrolled') {
          await course.refetch()
          router.push(`/learn/${result.enrollmentId}`)
        }
      } catch (e) {
        setError(e)
      } finally {
        setBusy(false)
      }
      return
    }
    if (Platform.OS === 'web') {
      router.push(`/checkout/${c.id}`)
      return
    }
    await WebBrowser.openBrowserAsync(`${webBaseUrl()}/course/${c.slug}?lang=${locale}`)
  }

  const ctaLabel = enrolled
    ? t('learnerCourse.cta.continue')
    : c.priceCents === 0
      ? t('learnerCourse.cta.enrolFree')
      : Platform.OS === 'web'
        ? t('learnerCourse.cta.enrolPrice', { price: formatSgd(c.priceCents) })
        : t('learnerCourse.cta.enrolOnWeb')
  const lessonsText = t(
    c.lessonCount === 1 ? 'learnerCourse.lessons.one' : 'learnerCourse.lessons.other',
    {
      count: c.lessonCount,
    },
  )
  const itemsText = (count: number) =>
    t(count === 1 ? 'learnerCourse.items.one' : 'learnerCourse.items.other', { count })

  const classes = (
    <ClassChoice course={c} chosenClassId={chosenClassId} cancelled={checkout === 'cancelled'} />
  )

  const cta = (
    <Card style={{ gap: theme.space[4] }} elevated>
      <View style={{ gap: 4 }}>
        <Text variant="eyebrow" tone="tertiary">
          {enrolled ? t('learnerCourse.cta.eyebrowEnrolled') : t('learnerCourse.cta.eyebrow')}
        </Text>
        <Text variant="display" style={{ fontSize: 36, lineHeight: 40 }}>
          {c.priceCents === 0 ? t('learnerCommon.price.free') : formatSgd(c.priceCents)}
        </Text>
        {!enrolled && c.priceCents > 0 ? (
          <Text variant="small" tone="secondary">
            {t('learnerCourse.cta.fees')}
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
      {/* A class's own checkout comes back with `class` set; its row says so instead. */}
      {checkout === 'cancelled' && !enrolled && !chosenClassId ? (
        <Text variant="small" tone="warning">
          {t('learnerCourse.cta.cancelled')}
        </Text>
      ) : null}
      {error !== null ? (
        <Text variant="small" tone="danger">
          {wordError(error)}
        </Text>
      ) : null}
      {Platform.OS !== 'web' && !enrolled && c.priceCents > 0 ? (
        <Text variant="caption" tone="tertiary">
          {t('learnerCourse.cta.nativeNote')}
        </Text>
      ) : null}
      <View style={{ gap: theme.space[2] }}>
        {[
          {
            icon: Layers,
            text: t('learnerCourse.facts.lessonsItems', {
              lessons: lessonsText,
              items: itemsText(c.artefactCount),
            }),
          },
          {
            icon: Clock,
            text: c.durationSeconds
              ? t('learnerCourse.facts.duration', { duration: formatMinutes(c.durationSeconds, t) })
              : t('learnerCourse.facts.selfPaced'),
          },
          { icon: Users, text: t('learnerCourse.facts.enrolled', { count: c.enrolCount }) },
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
              {t('learnerCourse.back')}
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
                <Badge label={categoryName(c.category, t)} tone="brand" />
                {enrolled ? (
                  <Badge label={t('learnerCourse.badge.enrolled')} tone="success" />
                ) : null}
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
            {!isLg ? classes : null}

            <View style={{ gap: theme.space[4] }}>
              <Text variant="h2">{t('learnerCourse.learn.title')}</Text>
              <Trail
                items={c.lessons.map((l) => {
                  const items = itemsText(l.artefacts.length)
                  const duration = formatMinutes(
                    l.artefacts.reduce((n, a) => n + (a.durationSeconds ?? 0), 0),
                    t,
                  )
                  return {
                    id: l.id,
                    title: l.title,
                    summary: l.summary,
                    meta: duration
                      ? t('learnerCourse.lesson.itemsDuration', { items, duration })
                      : items,
                    requires: l.prerequisiteIds
                      .map((id) => lessonTitle.get(id) ?? '')
                      .filter(Boolean),
                  }
                })}
              />
            </View>

            {c.descriptionJson ? (
              <View style={{ gap: theme.space[4] }}>
                <Text variant="h2">{t('learnerCourse.about.title')}</Text>
                <RichText doc={c.descriptionJson} />
              </View>
            ) : null}

            <Card style={{ gap: theme.space[3] }} muted>
              <Text variant="eyebrow" tone="tertiary">
                {t('learnerCourse.teacher.eyebrow')}
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
          {isLg ? (
            <View style={{ width: 340, gap: theme.space[6] }}>
              {cta}
              {classes}
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  )
}
