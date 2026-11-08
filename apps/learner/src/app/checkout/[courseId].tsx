import { formatSgd, type QuoteResponse } from '@elevate/core'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ArrowLeft, Lock, Tag } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { errorMessage } from '@/lib/api-error'
import { fetchQuote, startCheckout } from '@/lib/catalog'
import { useSession } from '@/lib/session'
import { webBaseUrl } from '@/lib/web-url'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Input, Screen, Skeleton, Text } from '@/ui'

export default function Checkout() {
  const { courseId = '' } = useLocalSearchParams<{ courseId: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { isSignedIn, isLoading } = useSession()
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [promo, setPromo] = useState('')
  const [promoError, setPromoError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!isSignedIn) {
      router.replace({ pathname: '/sign-in', params: { redirect: `/checkout/${courseId}` } })
      return
    }
    fetchQuote(courseId)
      .then(setQuote)
      .catch((e) => setLoadError(errorMessage(e)))
  }, [courseId, isSignedIn, isLoading, router])

  async function applyPromo() {
    setApplying(true)
    setPromoError(null)
    try {
      setQuote(await fetchQuote(courseId, promo.trim() || undefined))
    } catch (e) {
      setPromoError(errorMessage(e))
    } finally {
      setApplying(false)
    }
  }

  async function pay() {
    if (!quote) return
    setPaying(true)
    setPayError(null)
    try {
      const result = await startCheckout(courseId, quote.promo?.code)
      if (result.kind === 'enrolled') {
        router.replace(`/learn/${result.enrollmentId}`)
        return
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(result.url)
      else await WebBrowser.openBrowserAsync(result.url)
    } catch (e) {
      setPayError(errorMessage(e))
      setPaying(false)
    }
  }

  if (loadError) {
    return (
      <Screen maxWidth={640}>
        <EmptyState
          tone="danger"
          title="Could not start checkout"
          body={loadError}
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      </Screen>
    )
  }

  if (Platform.OS !== 'web' && quote && !quote.quote.isFree) {
    return (
      <Screen maxWidth={640}>
        <Card style={{ gap: theme.space[4] }}>
          <Text variant="eyebrow" tone="tertiary">
            Checkout
          </Text>
          <Text variant="h2">Payments happen on the web</Text>
          <Text tone="secondary">
            To keep prices low we take card payments on elevate.sg rather than through the app
            store. Your enrolment appears here as soon as you have paid.
          </Text>
          <Button
            label="Continue on the web"
            variant="accent"
            size="lg"
            fullWidth
            onPress={() =>
              WebBrowser.openBrowserAsync(`${webBaseUrl()}/course/${quote.course.slug}`)
            }
          />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </Card>
      </Screen>
    )
  }

  const q = quote?.quote

  return (
    <Screen maxWidth={640}>
      <View style={{ gap: theme.space[5] }}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={16} color={theme.colors.inkSecondary} />
          <Text variant="small" tone="secondary">
            Back to course
          </Text>
        </Pressable>
        <Text variant="h1">Checkout</Text>

        {!quote || !q ? (
          <Skeleton height={220} radius={theme.radii.card} />
        ) : (
          <>
            <Card style={{ flexDirection: 'row', gap: theme.space[4], alignItems: 'center' }}>
              <View
                style={{
                  width: 96,
                  aspectRatio: 4 / 3,
                  borderRadius: theme.radii.sm,
                  overflow: 'hidden',
                  backgroundColor: theme.colors.surfaceSunken,
                }}
              >
                {quote.course.thumbnailUrl ? (
                  <Image
                    source={{ uri: quote.course.thumbnailUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3" numberOfLines={2}>
                  {quote.course.title}
                </Text>
                <Text variant="small" tone="secondary">
                  by {quote.course.teacherName}
                </Text>
              </View>
            </Card>

            <Card style={{ gap: theme.space[4] }}>
              <View style={{ gap: theme.space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
                  <Tag size={16} color={theme.colors.inkTertiary} />
                  <Text variant="smallStrong" tone="secondary">
                    Promo code
                  </Text>
                </View>
                <View
                  style={{ flexDirection: 'row', gap: theme.space[2], alignItems: 'flex-start' }}
                >
                  <View style={{ flex: 1 }}>
                    <Input
                      value={promo}
                      onChangeText={setPromo}
                      placeholder="e.g. WELCOME10"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      error={promoError}
                      onSubmitEditing={applyPromo}
                    />
                  </View>
                  <Button
                    label={quote.promo ? 'Update' : 'Apply'}
                    variant="secondary"
                    onPress={applyPromo}
                    loading={applying}
                  />
                </View>
                {quote.promo ? (
                  <Text variant="small" tone="success">
                    {quote.promo.code} applied:{' '}
                    {quote.promo.type === 'percent'
                      ? `${quote.promo.value}% off`
                      : `${formatSgd(quote.promo.value)} off`}
                  </Text>
                ) : null}
              </View>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <View style={{ gap: theme.space[2] }}>
                <Row label="Course price" value={formatSgd(q.listPriceCents)} />
                {q.discountCents > 0 ? (
                  <Row label="Discount" value={`−${formatSgd(q.discountCents)}`} tone="success" />
                ) : null}
                <Row
                  label="Total today"
                  value={formatSgd(q.amountCents, { showFree: true })}
                  strong
                />
                <Text variant="caption" tone="tertiary">
                  Includes all payment processing fees. No subscription.
                </Text>
              </View>
              <Button
                label={q.isFree ? 'Enrol for free' : `Pay ${formatSgd(q.amountCents)} with Stripe`}
                variant="accent"
                size="lg"
                fullWidth
                icon={q.isFree ? undefined : Lock}
                loading={paying}
                disabled={q.belowMinimum}
                onPress={pay}
              />
              {q.belowMinimum ? (
                <Text variant="small" tone="danger">
                  The discounted price is below the minimum card payment. Remove the code to
                  continue.
                </Text>
              ) : null}
              {payError ? (
                <Text variant="small" tone="danger">
                  {payError}
                </Text>
              ) : null}
              <Text variant="caption" tone="tertiary" align="center">
                You will be taken to Stripe's secure checkout and back here when done.
              </Text>
            </Card>
          </>
        )}
      </View>
    </Screen>
  )
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'success'
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant={strong ? 'bodyStrong' : 'body'} tone={tone ?? (strong ? 'ink' : 'secondary')}>
        {label}
      </Text>
      <Text variant={strong ? 'price' : 'body'} tone={tone ?? 'ink'}>
        {value}
      </Text>
    </View>
  )
}
