import { type ClassForSale, type CoursePublicView, formatSgd } from '@elevate/core'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ArrowRight, CalendarDays, MapPin, Users, Video } from 'lucide-react-native'
import { useEffect } from 'react'
import { Platform, View } from 'react-native'
import { formatBlockTime } from '@/lib/classes'
import { usePreferences } from '@/lib/preferences'
import { webBaseUrl } from '@/lib/web-url'
import { useTheme } from '@/theme/ThemeProvider'
import { Badge, Button, Card, Text } from '@/ui'

/**
 * "Take it as a class" on the course page (docs/designs/scheduled-classes-selling.md, "Buying a
 * seat"): the course's classes on sale, each with its own button. On the web the button opens the
 * class checkout page; in the installed app it opens this page on the web with the class named in
 * the address, and the web page opens with that class chosen. A class the learner has a seat in
 * links to their class screen instead.
 */
export function ClassChoice({
  course,
  chosenClassId,
  cancelled,
}: {
  course: CoursePublicView
  /** The `class` in the address: scrolled to and marked. */
  chosenClassId?: string
  /** The learner came back from Stripe without paying for the chosen class. */
  cancelled: boolean
}) {
  const theme = useTheme()
  const { t } = usePreferences()
  const listed = new Set(course.classes.map((c) => c.id))
  const seatElsewhere = course.viewerClassSeats.find(
    (s) => s.status === 'active' && !listed.has(s.classId),
  )

  useEffect(() => {
    if (Platform.OS !== 'web' || !chosenClassId || typeof document === 'undefined') return
    document
      .getElementById(`class-${chosenClassId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [chosenClassId])

  if (course.classes.length === 0 && !seatElsewhere) return null

  return (
    <View style={{ gap: theme.space[3] }} testID="class-choice">
      <Text variant="h2">{t('learnerCourse.class.title')}</Text>
      <Text tone="secondary">{t('learnerCourse.class.intro')}</Text>
      {seatElsewhere ? (
        <SeatLink
          enrollmentId={seatElsewhere.enrollmentId}
          text={t('learnerCourse.class.seatElsewhere')}
        />
      ) : null}
      {course.classes.map((c) => (
        <ClassRow
          key={c.id}
          course={course}
          item={c}
          chosen={c.id === chosenClassId}
          cancelled={cancelled && c.id === chosenClassId}
        />
      ))}
      {Platform.OS !== 'web' && course.classes.length > 0 ? (
        <Text variant="caption" tone="tertiary">
          {t('learnerCourse.class.nativeNote')}
        </Text>
      ) : null}
    </View>
  )
}

function SeatLink({ enrollmentId, text }: { enrollmentId: string; text?: string }) {
  const theme = useTheme()
  const router = useRouter()
  const { t } = usePreferences()
  return (
    <View style={{ gap: theme.space[2], alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Badge label={t('learnerCourse.class.haveSeat')} tone="success" />
        {text ? (
          <Text variant="small" tone="secondary" style={{ flexShrink: 1 }}>
            {text}
          </Text>
        ) : null}
      </View>
      <Button
        testID={`class-view-${enrollmentId}`}
        label={t('learnerCourse.class.viewSeat')}
        variant="secondary"
        size="sm"
        iconRight={ArrowRight}
        onPress={() => router.push(`/class/${enrollmentId}`)}
      />
    </View>
  )
}

function ClassRow({
  course,
  item,
  chosen,
  cancelled,
}: {
  course: CoursePublicView
  item: ClassForSale
  chosen: boolean
  cancelled: boolean
}) {
  const theme = useTheme()
  const router = useRouter()
  const { t, locale } = usePreferences()
  const zoned = { timeZone: item.timeZone, locale }
  const seat = course.viewerClassSeats.find((s) => s.classId === item.id && s.status === 'active')
  const full = item.seatsLeft <= 0

  async function book() {
    if (Platform.OS === 'web') {
      router.push(`/checkout/class/${item.id}`)
      return
    }
    await WebBrowser.openBrowserAsync(
      `${webBaseUrl()}/course/${course.slug}?class=${item.id}&lang=${locale}`,
    )
  }

  return (
    <Card
      nativeID={`class-${item.id}`}
      testID={`class-row-${item.id}`}
      style={[
        { gap: theme.space[3] },
        chosen ? { borderColor: theme.colors.brand, borderWidth: 2 } : null,
      ]}
    >
      <View style={{ gap: 2 }}>
        <Text variant="h3">{item.name}</Text>
        <Text variant="small" tone="secondary">
          {t('learnerCourse.class.instructor', { name: item.instructorName })}
        </Text>
      </View>
      <View style={{ gap: theme.space[1] }}>
        {item.blocks.map((block) => (
          <View
            key={block.startsAt}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}
          >
            <CalendarDays size={14} color={theme.colors.inkTertiary} />
            <Text variant="small" style={{ flexShrink: 1 }}>
              {formatBlockTime(block, zoned, t)}
            </Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          {item.delivery === 'remote' ? (
            <Video size={14} color={theme.colors.inkTertiary} />
          ) : (
            <MapPin size={14} color={theme.colors.inkTertiary} />
          )}
          <Text variant="small" tone="secondary" style={{ flexShrink: 1 }}>
            {item.delivery === 'remote' || !item.venueAddress
              ? t('learnerCourse.class.remote')
              : t('learnerCourse.class.venue', { address: item.venueAddress })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <Users size={14} color={theme.colors.inkTertiary} />
          <Text variant="small" tone={full ? 'warning' : 'secondary'}>
            {full
              ? t('learnerCourse.class.full')
              : t(
                  item.seatsLeft === 1
                    ? 'learnerCourse.class.seatsLeft.one'
                    : 'learnerCourse.class.seatsLeft.other',
                  { count: item.seatsLeft },
                )}
          </Text>
        </View>
      </View>
      {seat ? (
        <SeatLink enrollmentId={seat.enrollmentId} />
      ) : full ? null : (
        <Button
          testID={`class-book-${item.id}`}
          label={
            Platform.OS === 'web'
              ? t('learnerCourse.class.book', { price: formatSgd(course.priceCents) })
              : t('learnerCourse.class.bookOnWeb')
          }
          variant={chosen ? 'accent' : 'secondary'}
          iconRight={ArrowRight}
          fullWidth
          onPress={book}
        />
      )}
      {cancelled && !seat ? (
        <Text variant="small" tone="warning">
          {t('learnerCourse.class.cancelled')}
        </Text>
      ) : null}
    </Card>
  )
}
