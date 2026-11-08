import { emailSchema } from '@elevate/core'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowRight, MailCheck } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, View } from 'react-native'
import { api } from '@/lib/api'
import { errorMessage, unwrap } from '@/lib/api-error'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, CodeInput, Input, Logo, Screen, Text } from '@/ui'

type Step = { kind: 'email' } | { kind: 'code'; email: string }

export default function SignIn() {
  const theme = useTheme()
  const router = useRouter()
  const { signIn } = useSession()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectPath =
    typeof redirect === 'string' && redirect.startsWith('/') ? redirect : undefined

  async function requestLink() {
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await unwrap(
        await api.auth['magic-link'].$post({
          json: { email: parsed.data, audience: 'learner', redirectPath },
        }),
      )
      setStep({ kind: 'code', email: parsed.data })
      setCode('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(value: string) {
    if (step.kind !== 'code') return
    setBusy(true)
    setError(null)
    try {
      const result = await unwrap(
        await api.auth.verify.$post({ json: { email: step.email, code: value } }),
      )
      await signIn(result.token, result.user)
      router.replace((result.redirectPath ?? redirectPath ?? '/') as never)
    } catch (e) {
      setError(errorMessage(e))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen maxWidth={520} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ gap: theme.space[6] }}>
        <Logo size="lg" />
        {step.kind === 'email' ? (
          <Card style={{ gap: theme.space[5] }}>
            <View style={{ gap: theme.space[2] }}>
              <Text variant="eyebrow" tone="tertiary">
                Sign in or create an account
              </Text>
              <Text variant="h1">Pick up where you left off.</Text>
              <Text tone="secondary">
                We will email you a one-time link and a 6-digit code. No passwords.
              </Text>
            </View>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={requestLink}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              textContentType="emailAddress"
              placeholder="you@example.com"
              error={error}
              returnKeyType="send"
            />
            <Button
              label="Email me a sign-in code"
              variant="accent"
              size="lg"
              iconRight={ArrowRight}
              loading={busy}
              onPress={requestLink}
              fullWidth
            />
            <Text variant="small" tone="tertiary">
              By continuing you agree to the Elevate terms. Teachers sign in at Elevate Teach.
            </Text>
          </Card>
        ) : (
          <Card style={{ gap: theme.space[5] }}>
            <View style={{ gap: theme.space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MailCheck size={20} color={theme.colors.brand} />
                <Text variant="eyebrow" tone="brand">
                  Check your inbox
                </Text>
              </View>
              <Text variant="h2">Enter the 6-digit code</Text>
              <Text tone="secondary">
                We sent it to <Text variant="bodyStrong">{step.email}</Text>.
                {Platform.OS === 'web' ? ' You can also click the link in the email.' : ''}
              </Text>
            </View>
            <CodeInput value={code} onChange={setCode} onComplete={verifyCode} error={error} />
            <Button
              label="Verify"
              variant="primary"
              size="lg"
              loading={busy}
              disabled={code.length !== 6}
              onPress={() => verifyCode(code)}
              fullWidth
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Button
                label="Use a different email"
                variant="ghost"
                size="sm"
                onPress={() => setStep({ kind: 'email' })}
              />
              <Button
                label="Resend code"
                variant="ghost"
                size="sm"
                onPress={requestLink}
                disabled={busy}
              />
            </View>
          </Card>
        )}
        <Link href="/" asChild>
          <Button label="Browse courses without signing in" variant="ghost" />
        </Link>
      </View>
    </Screen>
  )
}
