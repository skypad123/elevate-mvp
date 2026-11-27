import {
  type AttendanceState,
  type CheckInContext,
  type CheckInPlatform,
  LINK_CODE_LENGTH,
  normaliseTypedCode,
  TYPED_CODE_LENGTH,
} from '@elevate/core'
import { useQueryClient } from '@tanstack/react-query'
import Constants from 'expo-constants'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CheckCircle2, MapPin, ShieldAlert, Smartphone } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Platform, View } from 'react-native'
import { useErrorMessage } from '@/lib/api-error'
import {
  checkIn,
  checkInErrorMessage,
  classKeys,
  formatBlockTime,
  isCodeRefusal,
  useCheckInContext,
} from '@/lib/classes'
import { readLocation } from '@/lib/location'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, EmptyState, Input, Screen, Skeleton, Text } from '@/ui'

/** The installed app's scheme (`app.json`), for "Open the Elevate app" on a signed-out phone. */
const APP_SCHEME = 'elevate'

/** States in which the learner is already present: the screen says so and asks for nothing. */
const PRESENT: readonly AttendanceState[] = ['present', 'present_flagged', 'marked_by_hand']

const isWeb = () => Platform.OS === 'web'

function platform(): CheckInPlatform {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web'
}

/**
 * Check-in for one session (CUJs 2 to 5), on web and in the app. It opens signed out: in a
 * browser it offers the app or sign-in; in the app it goes to sign-in and comes back. The QR
 * link carries the code as `?c=`; otherwise the learner types the six characters.
 */
export default function CheckInScreen() {
  const { blockId = '', c } = useLocalSearchParams<{ blockId: string; c?: string }>()
  const router = useRouter()
  const theme = useTheme()
  const { isLoading, isSignedIn } = useSession()
  // Sign-in comes back here without the link's code, which has expired by then (CUJ 4).
  const here = `/class/check-in/${blockId}`

  useEffect(() => {
    if (isLoading || isSignedIn || isWeb()) return
    router.replace({ pathname: '/sign-in', params: { redirect: here } })
  }, [isLoading, isSignedIn, router, here])

  if (isLoading || (!isSignedIn && !isWeb())) {
    return (
      <Screen maxWidth={560} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand} />
      </Screen>
    )
  }
  if (!isSignedIn) return <SignedOut blockId={blockId} redirect={here} />
  return <SignedIn blockId={blockId} linkCode={typeof c === 'string' ? c : undefined} />
}

/** Signed out in a browser: open the installed app at this session, or sign in on this page. */
function SignedOut({ blockId, redirect }: { blockId: string; redirect: string }) {
  const theme = useTheme()
  const router = useRouter()
  const { t } = usePreferences()
  const [openedApp, setOpenedApp] = useState(false)
  const signIn = () => router.push({ pathname: '/sign-in', params: { redirect } })

  function openApp() {
    const url = `${APP_SCHEME}://class/check-in/${blockId}`
    setOpenedApp(true)
    // In the same tab, so the browser hands the address to the app instead of opening a blank tab.
    if (typeof window !== 'undefined' && window.location) window.location.assign(url)
    else void Linking.openURL(url).catch(() => {})
  }

  return (
    <Screen maxWidth={560} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <Card style={{ gap: theme.space[4] }} elevated>
        <Text variant="eyebrow" tone="tertiary">
          {t('learnerClass.checkIn.title')}
        </Text>
        <Text variant="h1">{t('learnerClass.signedOut.title')}</Text>
        <Text tone="secondary">{t('learnerClass.signedOut.body')}</Text>
        <Button
          testID="check-in-open-app"
          label={t('learnerClass.signedOut.openApp')}
          variant="accent"
          icon={Smartphone}
          fullWidth
          onPress={openApp}
        />
        {openedApp ? (
          <Button
            testID="check-in-fallback"
            label={t('learnerClass.signedOut.fallback')}
            variant="ghost"
            onPress={signIn}
          />
        ) : null}
        <Button
          testID="check-in-sign-in"
          label={t('learnerClass.signedOut.signIn')}
          variant="secondary"
          fullWidth
          onPress={signIn}
        />
      </Card>
    </Screen>
  )
}

function SignedIn({ blockId, linkCode }: { blockId: string; linkCode?: string }) {
  const theme = useTheme()
  const router = useRouter()
  const { t } = usePreferences()
  const errorMessage = useErrorMessage()
  const context = useCheckInContext(blockId, true)
  const enrollmentId = context.data?.enrollmentId

  const leave = () =>
    enrollmentId ? router.replace(`/class/${enrollmentId}`) : router.replace('/learning')
  const leaveLabel = enrollmentId
    ? t('learnerClass.checkIn.viewClass')
    : t('learnerClass.checkIn.myLearning')

  if (context.isPending) {
    return (
      <Screen maxWidth={560}>
        <View style={{ gap: theme.space[4] }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={32} />
          <Skeleton height={160} radius={theme.radii.card} />
        </View>
      </Screen>
    )
  }
  if (context.isError) {
    return (
      <Screen maxWidth={560}>
        <EmptyState
          icon={ShieldAlert}
          tone="danger"
          title={t('learnerClass.checkIn.loadError')}
          body={errorMessage(context.error)}
          action={{
            label: t('learnerClass.checkIn.myLearning'),
            onPress: () => router.replace('/learning'),
          }}
        />
      </Screen>
    )
  }
  return (
    <CheckInForm
      context={context.data}
      linkCode={linkCode}
      leave={{ label: leaveLabel, onPress: leave }}
    />
  )
}

function CheckInForm({
  context,
  linkCode,
  leave,
}: {
  context: CheckInContext
  linkCode?: string
  leave: { label: string; onPress: () => void }
}) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { t, locale } = usePreferences()
  const zoned = { timeZone: context.timeZone, locale }
  const fromAddress = linkCode ? normaliseTypedCode(linkCode) : ''
  const hasLinkCode = fromAddress.length === LINK_CODE_LENGTH
  const [code, setCode] = useState(hasLinkCode ? fromAddress : '')
  // True while the field holds the link's code untouched: it is sent as `qr_link`.
  const [fromLink, setFromLink] = useState(hasLinkCode)
  const [busy, setBusy] = useState(false)
  // Kept as data and worded at render, so a language switch rewords it.
  const [error, setError] = useState<unknown>(null)
  const [done, setDone] = useState(false)
  const asksLocationHere = isWeb() && context.asksLocation
  const ready = fromLink ? code.length === LINK_CODE_LENGTH : code.length === TYPED_CODE_LENGTH

  async function submit() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      // A remote class needs no location; the API keeps none for it whatever is sent.
      const location = context.asksLocation
        ? await readLocation()
        : ({ status: 'unsupported' } as const)
      const appVersion = Constants.expoConfig?.version
      await checkIn(context.blockId, {
        code,
        method: fromLink ? 'qr_link' : 'typed_code',
        platform: platform(),
        ...(appVersion ? { appVersion } : {}),
        clientTime: new Date().toISOString(),
        location,
      })
      setDone(true)
      void queryClient.invalidateQueries({ queryKey: classKeys.mine })
      void queryClient.invalidateQueries({ queryKey: classKeys.checkIn(context.blockId) })
    } catch (e) {
      setError(e)
      if (isCodeRefusal(e)) {
        setCode('')
        setFromLink(false)
      }
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="eyebrow" tone="tertiary">
        {t('learnerClass.checkIn.title')}
      </Text>
      <Text variant="h1">{context.className}</Text>
      <Text tone="secondary">{formatBlockTime(context, zoned, t)}</Text>
    </View>
  )

  const outcome = done
    ? t('learnerClass.checkIn.done')
    : PRESENT.includes(context.state)
      ? t('learnerClass.checkIn.already')
      : null
  if (outcome) {
    return (
      <Screen maxWidth={560} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <Card style={{ gap: theme.space[4] }} elevated>
          {header}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <CheckCircle2 size={28} color={theme.colors.success} />
            <Text variant="h2" testID="check-in-outcome">
              {outcome}
            </Text>
          </View>
          <Button label={leave.label} variant="secondary" fullWidth onPress={leave.onPress} />
        </Card>
      </Screen>
    )
  }
  if (context.state === 'overturned') {
    return (
      <Screen maxWidth={560} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <Card style={{ gap: theme.space[4] }} elevated>
          {header}
          <Text tone="danger">{t('learnerClass.checkIn.overturned')}</Text>
          <Button label={leave.label} variant="secondary" fullWidth onPress={leave.onPress} />
        </Card>
      </Screen>
    )
  }

  return (
    <Screen maxWidth={560} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <Card style={{ gap: theme.space[5] }} elevated>
        {header}
        {asksLocationHere ? (
          <View
            style={{
              flexDirection: 'row',
              gap: theme.space[3],
              padding: theme.space[4],
              borderRadius: theme.radii.card,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <MapPin size={20} color={theme.colors.brand} />
            <View style={{ flex: 1, gap: theme.space[1] }}>
              <Text variant="bodyStrong">{t('learnerClass.checkIn.locationTitle')}</Text>
              <Text variant="small" tone="secondary">
                {t('learnerClass.checkIn.locationBody')}
              </Text>
            </View>
          </View>
        ) : null}
        <Input
          testID="check-in-code"
          label={t('learnerClass.checkIn.codeLabel')}
          value={code}
          onChangeText={(text) => {
            setCode(normaliseTypedCode(text).slice(0, TYPED_CODE_LENGTH))
            setFromLink(false)
          }}
          onSubmitEditing={submit}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect={false}
          returnKeyType="go"
          helper={
            fromLink ? t('learnerClass.checkIn.codeFromLink') : t('learnerClass.checkIn.typeCode')
          }
          error={error === null ? null : checkInErrorMessage(error, zoned, t)}
        />
        <Button
          testID="check-in-submit"
          label={t('learnerClass.checkIn.submit')}
          variant="accent"
          size="lg"
          fullWidth
          disabled={!ready}
          loading={busy}
          onPress={submit}
        />
      </Card>
    </Screen>
  )
}
