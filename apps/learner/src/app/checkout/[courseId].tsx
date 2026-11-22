import { formatSgd, type QuoteResponse } from '@elevate/core'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ArrowLeft, Lock, Tag } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { useErrorMessage } from '@/lib/api-error'
import { fetchQuote, startCheckout } from '@/lib/catalog'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { webBaseUrl } from '@/lib/web-url'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Input, Screen, Skeleton, Text } from '@/ui'

export default function Checkout() {
  const { courseId = '' } = useLocalSearchParams<{ courseId: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { isSignedIn, isLoading } = useSession()
  const { locale, t } = usePreferences()
  const wordError = useErrorMessage()
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  // Errors are kept as the error objects and worded at render, so a language switch rewords them
  const [loadError, setLoadError] = useState<unknown>(null)
  const [promo, setPromo] = useState('')
  const [promoError, setPromoError] = useState<unknown>(null)
  const [applying, setApplying] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<unknown>(null)

  useEffect(() => {
    if (isLoading) return
    if (!isSignedIn) {
      router.replace({ pathname: '/sign-in', params: { redirect: `/checkout/${courseId}` } })
      return
    }
    fetchQuote(courseId)
      .then(setQuote)
      .catch((e: unknown) => setLoadError(e))
  }, [courseId, isSignedIn, isLoading, router])

  async function applyPromo() {
    setApplying(true)
    setPromoError(null)
    try {
      setQuote(await fetchQuote(courseId, promo.trim() || undefined))
    } catch (e) {
      setPromoError(e)
    } finally {
      setApplying(false)
    }
  }

  async function pay() {
    if (!quote) return
    setPaying(true)
    setPayError(null)
    try {
      const result = await startCheckout(courseId, { locale, promoCode: quote.promo?.code })
      if (result.kind === 'enrolled') {
        router.replace(`/learn/${result.enrollmentId}`)
        return
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(result.url)
      else await WebBrowser.openBrowserAsync(result.url)
    } catch (e) {
      setPayError(e)
      setPaying(false)
    }
  }

  if (loadError !== null) {
    return (
      <Screen maxWidth={640}>
        <EmptyState
          tone="danger"
          title={t('learnerCheckout.loadError.title')}
          body={wordError(loadError)}
          action={{ label: t('learnerCheckout.back'), onPress: () => router.back() }}
        />
      </Screen>
    )
  }

  if (Platform.OS !== 'web' && quote && !quote.quote.isFree) {
    return (
      <Screen maxWidth={640}>
        <Card style={{ gap: theme.space[4] }}>
          <Text variant="eyebrow" tone="tertiary">
            {t('learnerCheckout.title')}
          </Text>
          <Text variant="h2">{t('learnerCheckout.web.title')}</Text>
          <Text tone="secondary">{t('learnerCheckout.web.body')}</Text>
          <Button
            label={t('learnerCheckout.web.continue')}
            variant="accent"
            size="lg"
            fullWidth
            onPress={() =>
              WebBrowser.openBrowserAsync(
                `${webBaseUrl()}/course/${quote.course.slug}?lang=${locale}`,
              )
            }
          />
          <Button label={t('learnerCheckout.back')} variant="ghost" onPress={() => router.back()} />
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
            {t('learnerCheckout.backToCourse')}
          </Text>
        </Pressable>
        <Text variant="h1">{t('learnerCheckout.title')}</Text>

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
                  {t('learnerCheckout.byTeacher', { teacher: quote.course.teacherName })}
                </Text>
              </View>
            </Card>

            <Card style={{ gap: theme.space[4] }}>
              <View style={{ gap: theme.space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
                  <Tag size={16} color={theme.colors.inkTertiary} />
                  <Text variant="smallStrong" tone="secondary">
                    {t('learnerCheckout.promo.label')}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: 'row', gap: theme.space[2], alignItems: 'flex-start' }}
                >
                  <View style={{ flex: 1 }}>
                    <Input
                      value={promo}
                      onChangeText={setPromo}
                      placeholder={t('learnerCheckout.promo.placeholder')}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      error={promoError !== null ? wordError(promoError) : null}
                      onSubmitEditing={applyPromo}
                    />
                  </View>
                  <Button
                    label={
                      quote.promo
                        ? t('learnerCheckout.promo.update')
                        : t('learnerCheckout.promo.apply')
                    }
                    variant="secondary"
                    onPress={applyPromo}
                    loading={applying}
                  />
                </View>
                {quote.promo ? (
                  <Text variant="small" tone="success">
                    {quote.promo.type === 'percent'
                      ? t('learnerCheckout.promo.appliedPercent', {
                          code: quote.promo.code,
                          percent: quote.promo.value,
                        })
                      : t('learnerCheckout.promo.appliedAmount', {
                          code: quote.promo.code,
                          amount: formatSgd(quote.promo.value),
                        })}
                  </Text>
                ) : null}
              </View>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <View style={{ gap: theme.space[2] }}>
                <Row label={t('learnerCheckout.row.price')} value={formatSgd(q.listPriceCents)} />
                {q.discountCents > 0 ? (
                  <Row
                    label={t('learnerCheckout.row.discount')}
                    value={`−${formatSgd(q.discountCents)}`}
                    tone="success"
                  />
                ) : null}
                <Row
                  label={t('learnerCheckout.row.total')}
                  value={
                    q.amountCents === 0 ? t('learnerCommon.price.free') : formatSgd(q.amountCents)
                  }
                  strong
                />
                <Text variant="caption" tone="tertiary">
                  {t('learnerCheckout.fees')}
                </Text>
              </View>
              <Button
                label={
                  q.isFree
                    ? t('learnerCheckout.pay.free')
                    : t('learnerCheckout.pay.stripe', { price: formatSgd(q.amountCents) })
                }
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
                  {t('learnerCheckout.belowMinimum')}
                </Text>
              ) : null}
              {payError !== null ? (
                <Text variant="small" tone="danger">
                  {wordError(payError)}
                </Text>
              ) : null}
              <Text variant="caption" tone="tertiary" align="center">
                {t('learnerCheckout.stripeNote')}
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
