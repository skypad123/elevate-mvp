import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CalendarDays, CheckCircle2, Clock, MapPin, ShieldAlert, Video } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useErrorMessage } from '@/lib/api-error'
import { catalogKeys, syncCheckout } from '@/lib/catalog'
import { classKeys, formatBlockTime, useMyClasses } from '@/lib/classes'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Screen, Text } from '@/ui'

type State =
  | { kind: 'checking' }
  | { kind: 'paid'; enrollmentId: string; courseSlug: string }
  // A seat in a class: the class screen, not the lessons, is where the learner goes next
  | { kind: 'paidClass'; enrollmentId: string; courseSlug: string }
  // The payment got no seat and is being returned in full
  | { kind: 'seatLost'; courseSlug: string }
  | { kind: 'expired' }
  // Why it failed, worded at render so a language switch rewords it
  | { kind: 'noSession' }
  | { kind: 'slow' }
  | { kind: 'error'; error: unknown }

/** Stripe redirects here with ?session_id=; we confirm fulfilment with the API (webhook or sync). */
export default function CheckoutSuccess() {
  const { session_id: sessionId } = useLocalSearchParams<{ session_id?: string }>()
  const theme = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isLoading, isSignedIn } = useSession()
  const { t } = usePreferences()
  const wordError = useErrorMessage()
  const [state, setState] = useState<State>({ kind: 'checking' })
  const attempts = useRef(0)

  useEffect(() => {
    if (isLoading) return
    if (!isSignedIn) {
      router.replace({
        pathname: '/sign-in',
        params: { redirect: `/checkout/success?session_id=${sessionId ?? ''}` },
      })
      return
    }
    if (!sessionId) {
      setState({ kind: 'noSession' })
      return
    }
    let cancelled = false
    const tick = async () => {
      try {
        const result = await syncCheckout(sessionId)
        if (cancelled) return
        if (result.status === 'paid') {
          await queryClient.invalidateQueries({ queryKey: catalogKeys.enrollments })
          await queryClient.invalidateQueries({ queryKey: ['catalog', 'course'] })
          if (result.classId) await queryClient.invalidateQueries({ queryKey: classKeys.mine })
          setState({
            kind: result.classId ? 'paidClass' : 'paid',
            enrollmentId: result.enrollmentId,
            courseSlug: result.courseSlug,
          })
          return
        }
        if (result.status === 'seat_lost') {
          await queryClient.invalidateQueries({ queryKey: ['catalog', 'course'] })
          setState({ kind: 'seatLost', courseSlug: result.courseSlug })
          return
        }
        if (result.status === 'expired') {
          setState({ kind: 'expired' })
          return
        }
        attempts.current += 1
        if (attempts.current < 15) setTimeout(tick, 2000)
        else setState({ kind: 'slow' })
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', error: e })
      }
    }
    void tick()
    return () => {
      cancelled = true
    }
  }, [sessionId, isLoading, isSignedIn, router, queryClient])

  return (
    <Screen maxWidth={560} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      {state.kind === 'checking' ? (
        <View style={{ alignItems: 'center', gap: theme.space[4] }}>
          <ActivityIndicator color={theme.colors.brand} />
          <Text tone="secondary">{t('learnerCheckout.success.checking')}</Text>
        </View>
      ) : state.kind === 'paid' ? (
        <Card style={{ gap: theme.space[4], alignItems: 'center' }} elevated>
          <CheckCircle2 size={40} color={theme.colors.success} />
          <Text variant="eyebrow" tone="brand">
            {t('learnerCheckout.success.eyebrow')}
          </Text>
          <Text variant="h1" align="center">
            {t('learnerCheckout.success.title')}
          </Text>
          <Text tone="secondary" align="center">
            {t('learnerCheckout.success.body')}
          </Text>
          <Button
            label={t('learnerCheckout.success.start')}
            variant="accent"
            size="lg"
            fullWidth
            onPress={() => router.replace(`/learn/${state.enrollmentId}`)}
          />
          <Button
            label={t('learnerCheckout.success.backToCourse')}
            variant="ghost"
            onPress={() => router.replace(`/course/${state.courseSlug}`)}
          />
        </Card>
      ) : state.kind === 'paidClass' ? (
        <ClassBooked enrollmentId={state.enrollmentId} courseSlug={state.courseSlug} />
      ) : state.kind === 'seatLost' ? (
        <EmptyState
          icon={ShieldAlert}
          tone="danger"
          title={t('learnerCheckout.seatLost.title')}
          body={t('learnerCheckout.seatLost.body')}
          action={{
            label: t('learnerCheckout.seatLost.back'),
            onPress: () => router.replace(`/course/${state.courseSlug}`),
          }}
        />
      ) : state.kind === 'expired' ? (
        <EmptyState
          icon={Clock}
          title={t('learnerCheckout.expired.title')}
          body={t('learnerCheckout.expired.body')}
          action={{
            label: t('learnerCheckout.expired.explore'),
            onPress: () => router.replace('/'),
          }}
        />
      ) : (
        <EmptyState
          icon={ShieldAlert}
          tone="danger"
          title={t('learnerCheckout.failed.title')}
          body={
            state.kind === 'noSession'
              ? t('learnerCheckout.failed.noSession')
              : state.kind === 'slow'
                ? t('learnerCheckout.failed.slow')
                : wordError(state.error)
          }
          action={{
            label: t('learnerCheckout.failed.myLearning'),
            onPress: () => router.replace('/learning'),
          }}
        />
      )}
    </Screen>
  )
}

/** The class confirmation: the seat is booked, with the class's sessions and place. */
function ClassBooked({ enrollmentId, courseSlug }: { enrollmentId: string; courseSlug: string }) {
  const theme = useTheme()
  const router = useRouter()
  const { t, locale } = usePreferences()
  const classes = useMyClasses(true)
  const item = classes.data?.find((c) => c.enrollmentId === enrollmentId)
  const zoned = item ? { timeZone: item.class.timeZone, locale } : null
  return (
    <Card style={{ gap: theme.space[4] }} elevated testID="class-booked">
      <View style={{ alignItems: 'center', gap: theme.space[3] }}>
        <CheckCircle2 size={40} color={theme.colors.success} />
        <Text variant="eyebrow" tone="brand">
          {t('learnerCheckout.classSuccess.eyebrow')}
        </Text>
        <Text variant="h1" align="center">
          {t('learnerCheckout.classSuccess.title')}
        </Text>
        {item ? (
          <Text tone="secondary" align="center">
            {t('learnerCheckout.classSuccess.body', {
              name: item.class.name,
              course: item.class.courseTitle,
            })}
          </Text>
        ) : null}
      </View>
      {item && zoned ? (
        <View style={{ gap: theme.space[1] }}>
          <Text variant="smallStrong" tone="secondary">
            {t('learnerCheckout.classSuccess.when')}
          </Text>
          {item.blocks.map((block) => (
            <View
              key={block.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}
            >
              <CalendarDays size={14} color={theme.colors.inkTertiary} />
              <Text variant="small" style={{ flexShrink: 1 }}>
                {formatBlockTime(block, zoned, t)}
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            {item.class.delivery === 'remote' ? (
              <Video size={14} color={theme.colors.inkTertiary} />
            ) : (
              <MapPin size={14} color={theme.colors.inkTertiary} />
            )}
            <Text variant="small" tone="secondary" style={{ flexShrink: 1 }}>
              {item.class.delivery === 'remote' || !item.class.venueAddress
                ? t('learnerCheckout.classSuccess.remote')
                : t('learnerCheckout.classSuccess.venue', { address: item.class.venueAddress })}
            </Text>
          </View>
        </View>
      ) : classes.isPending ? (
        <ActivityIndicator color={theme.colors.brand} />
      ) : null}
      <Button
        testID="class-booked-view"
        label={t('learnerCheckout.classSuccess.view')}
        variant="accent"
        size="lg"
        fullWidth
        onPress={() => router.replace(`/class/${enrollmentId}`)}
      />
      <Button
        label={t('learnerCheckout.success.backToCourse')}
        variant="ghost"
        onPress={() => router.replace(`/course/${courseSlug}`)}
      />
    </Card>
  )
}
