import { isChosen } from '@elevate/core'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ShieldAlert } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { api } from '@/lib/api'
import { unwrap, useErrorMessage } from '@/lib/api-error'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, EmptyState, Screen, Text } from '@/ui'

/** What went wrong, worded at render so a language switch rewords it. */
type VerifyError = { kind: 'incomplete' } | { kind: 'api'; error: unknown } | null

/** Landing route for the emailed link: /verify?token=…&redirect=/course/x */
export default function Verify() {
  const theme = useTheme()
  const router = useRouter()
  const { signIn } = useSession()
  const { locale, preferences, t } = usePreferences()
  const errorMessage = useErrorMessage()
  const localeChosen = isChosen(preferences.locale)
  const { token, redirect } = useLocalSearchParams<{ token?: string; redirect?: string }>()
  const [error, setError] = useState<VerifyError>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (typeof token !== 'string' || token.length < 16) {
      setError({ kind: 'incomplete' })
      return
    }
    ;(async () => {
      try {
        const result = await unwrap(
          await api.auth.verify.$post({ json: { token, locale, localeChosen } }),
        )
        await signIn(result.token, result.user)
        const target =
          result.redirectPath ??
          (typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/')
        router.replace(target as never)
      } catch (e) {
        setError({ kind: 'api', error: e })
      }
    })()
  }, [token, redirect, router, signIn, locale, localeChosen])

  return (
    <Screen maxWidth={520} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      {error ? (
        <View style={{ gap: theme.space[4] }}>
          <EmptyState
            icon={ShieldAlert}
            tone="danger"
            eyebrow={t('learnerAuth.verify.eyebrow')}
            title={t('learnerAuth.verify.failed')}
            body={
              error.kind === 'incomplete'
                ? t('learnerAuth.verify.incomplete')
                : errorMessage(error.error)
            }
          />
          <Link href="/sign-in" asChild>
            <Button label={t('learnerAuth.verify.requestNew')} variant="primary" fullWidth />
          </Link>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: theme.space[4] }}>
          <ActivityIndicator color={theme.colors.brand} />
          <Text tone="secondary">{t('learnerAuth.verify.signingIn')}</Text>
        </View>
      )}
    </Screen>
  )
}
