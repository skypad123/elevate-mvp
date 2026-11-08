import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { errorMessage } from '@/lib/api-error'
import { catalogKeys, syncCheckout } from '@/lib/catalog'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Screen, Text } from '@/ui'

type State =
  | { kind: 'checking' }
  | { kind: 'paid'; enrollmentId: string; courseSlug: string }
  | { kind: 'expired' }
  | { kind: 'error'; message: string }

/** Stripe redirects here with ?session_id=; we confirm fulfilment with the API (webhook or sync). */
export default function CheckoutSuccess() {
  const { session_id: sessionId } = useLocalSearchParams<{ session_id?: string }>()
  const theme = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isLoading, isSignedIn } = useSession()
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
      setState({ kind: 'error', message: 'This page needs a checkout session.' })
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
          setState({
            kind: 'paid',
            enrollmentId: result.enrollmentId,
            courseSlug: result.courseSlug,
          })
          return
        }
        if (result.status === 'expired') {
          setState({ kind: 'expired' })
          return
        }
        attempts.current += 1
        if (attempts.current < 15) setTimeout(tick, 2000)
        else
          setState({
            kind: 'error',
            message:
              'Payment confirmation is taking longer than usual. Your enrolment will appear in My Learning once Stripe confirms it.',
          })
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: errorMessage(e) })
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
          <Text tone="secondary">Confirming your payment…</Text>
        </View>
      ) : state.kind === 'paid' ? (
        <Card style={{ gap: theme.space[4], alignItems: 'center' }} elevated>
          <CheckCircle2 size={40} color={theme.colors.success} />
          <Text variant="eyebrow" tone="brand">
            Enrolled
          </Text>
          <Text variant="h1" align="center">
            You're in.
          </Text>
          <Text tone="secondary" align="center">
            A confirmation email is on its way. Your progress is saved as you go, on any device.
          </Text>
          <Button
            label="Start learning"
            variant="accent"
            size="lg"
            fullWidth
            onPress={() => router.replace(`/learn/${state.enrollmentId}`)}
          />
          <Button
            label="Back to course page"
            variant="ghost"
            onPress={() => router.replace(`/course/${state.courseSlug}`)}
          />
        </Card>
      ) : state.kind === 'expired' ? (
        <EmptyState
          icon={Clock}
          title="That checkout expired"
          body="No payment was taken. Start again from the course page."
          action={{ label: 'Explore courses', onPress: () => router.replace('/') }}
        />
      ) : (
        <EmptyState
          icon={ShieldAlert}
          tone="danger"
          title="We could not confirm the payment"
          body={state.message}
          action={{ label: 'Go to My Learning', onPress: () => router.replace('/learning') }}
        />
      )}
    </Screen>
  )
}
