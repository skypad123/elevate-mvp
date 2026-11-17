import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useErrorMessage } from '@/lib/api-error'
import { catalogKeys, syncCheckout } from '@/lib/catalog'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Screen, Text } from '@/ui'

type State =
  | { kind: 'checking' }
  | { kind: 'paid'; enrollmentId: string; courseSlug: string }
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
