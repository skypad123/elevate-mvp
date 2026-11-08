import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ShieldAlert } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { api } from '@/lib/api'
import { errorMessage, unwrap } from '@/lib/api-error'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, EmptyState, Screen, Text } from '@/ui'

/** Landing route for the emailed link: /verify?token=…&redirect=/course/x */
export default function Verify() {
  const theme = useTheme()
  const router = useRouter()
  const { signIn } = useSession()
  const { token, redirect } = useLocalSearchParams<{ token?: string; redirect?: string }>()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (typeof token !== 'string' || token.length < 16) {
      setError('This sign-in link is incomplete. Request a new one.')
      return
    }
    ;(async () => {
      try {
        const result = await unwrap(await api.auth.verify.$post({ json: { token } }))
        await signIn(result.token, result.user)
        const target =
          result.redirectPath ??
          (typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/')
        router.replace(target as never)
      } catch (e) {
        setError(errorMessage(e))
      }
    })()
  }, [token, redirect, router, signIn])

  return (
    <Screen maxWidth={520} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      {error ? (
        <View style={{ gap: theme.space[4] }}>
          <EmptyState
            icon={ShieldAlert}
            tone="danger"
            eyebrow="Sign-in link"
            title="We could not sign you in"
            body={error}
          />
          <Link href="/sign-in" asChild>
            <Button label="Request a new link" variant="primary" fullWidth />
          </Link>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: theme.space[4] }}>
          <ActivityIndicator color={theme.colors.brand} />
          <Text tone="secondary">Signing you in…</Text>
        </View>
      )}
    </Screen>
  )
}
