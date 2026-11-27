import {
  type ClassCheckoutView,
  type ClassForSale,
  formatSgd,
  withdrawalClosesAt,
} from '@elevate/core'
import type { MessageKey } from '@elevate/i18n'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ArrowLeft, CalendarDays, Lock, MapPin, Tag, Users, Video } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { ApiError, useErrorMessage } from '@/lib/api-error'
import { fetchClassCheckout, startClassCheckout } from '@/lib/catalog'
import { formatBlockTime, formatClassInstant } from '@/lib/classes'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { webBaseUrl } from '@/lib/web-url'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Input, Screen, Skeleton, Text } from '@/ui'

/**
 * The refund terms (docs/terms/class-refund-terms.md), section by section, in the order of that
 * file. The page shows them above the pay button and sends the version it showed.
 */
const TERMS: readonly { title: MessageKey; terms: readonly MessageKey[] }[] = [
  { title: 'learnerCheckout.terms.buying.title', terms: ['learnerCheckout.terms.buying.1'] },
  {
    title: 'learnerCheckout.terms.changeMind.title',
    terms: [
      'learnerCheckout.terms.changeMind.2',
      'learnerCheckout.terms.changeMind.3',
      'learnerCheckout.terms.changeMind.4',
    ],
  },
  { title: 'learnerCheckout.terms.changes.title', terms: ['learnerCheckout.terms.changes.5'] },
  {
    title: 'learnerCheckout.terms.cancelled.title',
    terms: [
      'learnerCheckout.terms.cancelled.6',
      'learnerCheckout.terms.cancelled.7',
      'learnerCheckout.terms.cancelled.8',
    ],
  },
  {
    title: 'learnerCheckout.terms.attended.title',
    terms: ['learnerCheckout.terms.attended.9', 'learnerCheckout.terms.attended.10'],
  },
  {
    title: 'learnerCheckout.terms.seatTaken.title',
    terms: ['learnerCheckout.terms.seatTaken.11'],
  },
  { title: 'learnerCheckout.terms.paid.title', terms: ['learnerCheckout.terms.paid.12'] },
  {
    title: 'learnerCheckout.terms.fee.title',
    terms: [
      'learnerCheckout.terms.fee.13',
      'learnerCheckout.terms.fee.cardSg',
      'learnerCheckout.terms.fee.cardAbroad',
      'learnerCheckout.terms.fee.paynow',
      'learnerCheckout.terms.fee.gst',
      'learnerCheckout.terms.fee.example',
    ],
  },
]

/** The term numbers of the terms file, beside each sentence that is a numbered term. */
const NUMBERED: Partial<Record<MessageKey, number>> = {
  'learnerCheckout.terms.buying.1': 1,
  'learnerCheckout.terms.changeMind.2': 2,
  'learnerCheckout.terms.changeMind.3': 3,
  'learnerCheckout.terms.changeMind.4': 4,
  'learnerCheckout.terms.changes.5': 5,
  'learnerCheckout.terms.cancelled.6': 6,
  'learnerCheckout.terms.cancelled.7': 7,
  'learnerCheckout.terms.cancelled.8': 8,
  'learnerCheckout.terms.attended.9': 9,
  'learnerCheckout.terms.attended.10': 10,
  'learnerCheckout.terms.seatTaken.11': 11,
  'learnerCheckout.terms.paid.12': 12,
  'learnerCheckout.terms.fee.13': 13,
}

/**
 * Class checkout (docs/designs/scheduled-classes-selling.md, "Buying a seat"): the class, the
 * price, a promo code, the refund terms above the pay button, and Pay. The terms version the page
 * was given is the one it sends; when the API answers `terms_changed` the page loads the terms
 * again and says so. A seat is paid for on the web; the installed app hands over to it.
 */
export default function ClassCheckout() {
  const { classId = '' } = useLocalSearchParams<{ classId: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { isSignedIn, isLoading } = useSession()
  const { locale, t } = usePreferences()
  const wordError = useErrorMessage()
  const [view, setView] = useState<ClassCheckoutView | null>(null)
  // Errors are kept as the error objects and worded at render, so a language switch rewords them
  const [loadError, setLoadError] = useState<unknown>(null)
  const [promo, setPromo] = useState('')
  const [promoError, setPromoError] = useState<unknown>(null)
  const [applying, setApplying] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<unknown>(null)
  const [termsReloaded, setTermsReloaded] = useState(false)

  const load = useCallback(
    (promoCode?: string) => fetchClassCheckout(classId, promoCode),
    [classId],
  )

  useEffect(() => {
    if (isLoading) return
    if (!isSignedIn) {
      router.replace({ pathname: '/sign-in', params: { redirect: `/checkout/class/${classId}` } })
      return
    }
    load()
      .then(setView)
      .catch((e: unknown) => setLoadError(e))
  }, [classId, isSignedIn, isLoading, router, load])

  async function applyPromo() {
    setApplying(true)
    setPromoError(null)
    try {
      setView(await load(promo.trim() || undefined))
    } catch (e) {
      setPromoError(e)
    } finally {
      setApplying(false)
    }
  }

  async function pay() {
    if (!view) return
    setPaying(true)
    setPayError(null)
    setTermsReloaded(false)
    try {
      const result = await startClassCheckout(classId, {
        locale,
        promoCode: view.quote.promo?.code,
        termsVersion: view.refundTermsVersion,
      })
      if (result.kind === 'enrolled') {
        router.replace(`/class/${result.enrollmentId}`)
        return
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(result.url)
      else await WebBrowser.openBrowserAsync(result.url)
    } catch (e) {
      setPaying(false)
      if (e instanceof ApiError && (e.code === 'terms_changed' || e.code === 'class_full')) {
        // Show what is true now: the new terms to read, or no seat left.
        try {
          setView(await load(view.quote.promo?.code))
        } catch (reload) {
          setLoadError(reload)
          return
        }
        if (e.code === 'terms_changed') {
          setTermsReloaded(true)
          return
        }
      }
      setPayError(e)
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

  if (Platform.OS !== 'web' && view) {
    return (
      <Screen maxWidth={640}>
        <Card style={{ gap: theme.space[4] }}>
          <Text variant="eyebrow" tone="tertiary">
            {t('learnerCheckout.class.title')}
          </Text>
          <Text variant="h2">{t('learnerCheckout.web.title')}</Text>
          <Text tone="secondary">{t('learnerCheckout.class.web.body')}</Text>
          <Button
            label={t('learnerCheckout.web.continue')}
            variant="accent"
            size="lg"
            fullWidth
            onPress={() =>
              WebBrowser.openBrowserAsync(
                `${webBaseUrl()}/course/${view.courseSlug}?class=${view.class.id}&lang=${locale}`,
              )
            }
          />
          <Button label={t('learnerCheckout.back')} variant="ghost" onPress={() => router.back()} />
        </Card>
      </Screen>
    )
  }

  const q = view?.quote.quote
  const full = view ? view.class.seatsLeft <= 0 : false
  const alreadyIn =
    payError instanceof ApiError && payError.code === 'already_in_class'
      ? ((payError.details as { enrollmentId?: unknown } | undefined)?.enrollmentId ?? null)
      : null

  return (
    <Screen maxWidth={640}>
      <View style={{ gap: theme.space[5] }}>
        <Pressable
          onPress={() =>
            view ? router.replace(`/course/${view.courseSlug}?class=${classId}`) : router.back()
          }
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={16} color={theme.colors.inkSecondary} />
          <Text variant="small" tone="secondary">
            {t('learnerCheckout.backToCourse')}
          </Text>
        </Pressable>
        <Text variant="h1">{t('learnerCheckout.class.title')}</Text>

        {!view || !q ? (
          <Skeleton height={320} radius={theme.radii.card} />
        ) : (
          <>
            <ClassSummary view={view} />

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
                      testID="class-checkout-promo"
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
                    testID="class-checkout-apply"
                    label={
                      view.quote.promo
                        ? t('learnerCheckout.promo.update')
                        : t('learnerCheckout.promo.apply')
                    }
                    variant="secondary"
                    onPress={applyPromo}
                    loading={applying}
                  />
                </View>
                {view.quote.promo ? (
                  <Text variant="small" tone="success">
                    {view.quote.promo.type === 'percent'
                      ? t('learnerCheckout.promo.appliedPercent', {
                          code: view.quote.promo.code,
                          percent: view.quote.promo.value,
                        })
                      : t('learnerCheckout.promo.appliedAmount', {
                          code: view.quote.promo.code,
                          amount: formatSgd(view.quote.promo.value),
                        })}
                  </Text>
                ) : null}
              </View>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <View style={{ gap: theme.space[2] }}>
                <Row
                  label={t('learnerCheckout.class.row.price')}
                  value={formatSgd(q.listPriceCents)}
                />
                {q.discountCents > 0 ? (
                  <Row
                    label={t('learnerCheckout.row.discount')}
                    value={`−${formatSgd(q.discountCents)}`}
                    tone="success"
                  />
                ) : null}
                <Row
                  label={t('learnerCheckout.row.total')}
                  value={formatSgd(q.amountCents)}
                  strong
                />
              </View>
            </Card>

            <RefundTerms view={view} />

            <Card style={{ gap: theme.space[3] }}>
              {termsReloaded ? (
                <Text variant="small" tone="warning" testID="class-checkout-terms-reloaded">
                  {t('learnerCheckout.class.termsReloaded')}
                </Text>
              ) : null}
              {full ? (
                <Text tone="warning" testID="class-checkout-full">
                  {t('learnerCheckout.class.full')}
                </Text>
              ) : (
                <>
                  <Text variant="small" tone="secondary">
                    {t('learnerCheckout.class.agree')}
                  </Text>
                  <Button
                    testID="class-checkout-pay"
                    label={t('learnerCheckout.pay.stripe', { price: formatSgd(q.amountCents) })}
                    variant="accent"
                    size="lg"
                    fullWidth
                    icon={Lock}
                    loading={paying}
                    onPress={pay}
                  />
                  <Text variant="caption" tone="tertiary">
                    {t('learnerCheckout.class.seatHeld')}
                  </Text>
                </>
              )}
              {payError !== null ? (
                <Text variant="small" tone="danger" testID="class-checkout-error">
                  {wordError(payError)}
                </Text>
              ) : null}
              {typeof alreadyIn === 'string' ? (
                <Button
                  label={t('learnerCheckout.class.viewSeat')}
                  variant="secondary"
                  onPress={() => router.replace(`/class/${alreadyIn}`)}
                />
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

/** The class: course, name, instructor, sessions, place and seats left. */
function ClassSummary({ view }: { view: ClassCheckoutView }) {
  const theme = useTheme()
  const { t } = usePreferences()
  const c = view.class
  return (
    <Card style={{ gap: theme.space[3] }} testID="class-checkout-summary">
      <View style={{ gap: 2 }}>
        <Text variant="eyebrow" tone="tertiary">
          {t('learnerCheckout.class.course', { course: view.courseTitle })}
        </Text>
        <Text variant="h3">{c.name}</Text>
        <Text variant="small" tone="secondary">
          {t('learnerCheckout.class.instructor', { name: c.instructorName })}
        </Text>
      </View>
      <ClassFacts item={c} heading={t('learnerCheckout.class.sessions')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Users size={14} color={theme.colors.inkTertiary} />
        <Text variant="small" tone={c.seatsLeft <= 0 ? 'warning' : 'secondary'}>
          {c.seatsLeft <= 0
            ? t('learnerCheckout.class.full')
            : t(
                c.seatsLeft === 1
                  ? 'learnerCheckout.class.seatsLeft.one'
                  : 'learnerCheckout.class.seatsLeft.other',
                { count: c.seatsLeft },
              )}
        </Text>
      </View>
    </Card>
  )
}

/** A class's sessions, one a line, and where it meets. */
function ClassFacts({ item, heading }: { item: ClassForSale; heading: string }) {
  const theme = useTheme()
  const { t, locale } = usePreferences()
  const zoned = { timeZone: item.timeZone, locale }
  return (
    <View style={{ gap: theme.space[1] }}>
      <Text variant="smallStrong" tone="secondary">
        {heading}
      </Text>
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
            ? t('learnerCheckout.class.remote')
            : t('learnerCheckout.class.venue', { address: item.venueAddress })}
        </Text>
      </View>
    </View>
  )
}

/** The refund terms, whole sentences, with this class's withdrawal deadline first. */
function RefundTerms({ view }: { view: ClassCheckoutView }) {
  const theme = useTheme()
  const { t, locale } = usePreferences()
  const first = view.class.blocks[0]
  const zoned = { timeZone: view.class.timeZone, locale }
  return (
    <Card style={{ gap: theme.space[3] }} muted testID="class-checkout-terms">
      <View style={{ gap: 2 }}>
        <Text variant="h3">{t('learnerCheckout.terms.title')}</Text>
        <Text variant="caption" tone="tertiary">
          {t('learnerCheckout.terms.version', { version: view.refundTermsVersion })}
        </Text>
      </View>
      {first ? (
        <Text variant="smallStrong">
          {t('learnerCheckout.terms.forThisClass', {
            date: formatClassInstant(withdrawalClosesAt(first.startsAt).toISOString(), zoned, t),
          })}
        </Text>
      ) : null}
      {TERMS.map((section) => (
        <View key={section.title} style={{ gap: theme.space[1] }}>
          <Text variant="smallStrong" tone="secondary">
            {t(section.title)}
          </Text>
          {section.terms.map((key) => {
            const n = NUMBERED[key]
            return (
              <View key={key} style={{ flexDirection: 'row', gap: theme.space[2] }}>
                <Text variant="small" tone="tertiary" style={{ minWidth: 20 }}>
                  {n ? `${n}.` : '•'}
                </Text>
                <Text variant="small" tone="secondary" style={{ flex: 1 }}>
                  {t(key)}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
    </Card>
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
