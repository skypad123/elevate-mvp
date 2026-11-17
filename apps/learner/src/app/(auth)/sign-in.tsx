import { emailSchema, isChosen } from '@elevate/core'
import { fillSlots } from '@elevate/i18n/react'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowRight, MailCheck } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, View } from 'react-native'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { api } from '@/lib/api'
import { unwrap, useErrorMessage } from '@/lib/api-error'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Card, CodeInput, Input, Logo, Screen, Text } from '@/ui'

type Step = { kind: 'email' } | { kind: 'code'; email: string }
/** Kept as data and worded at render, so a language switch rewords a shown error. */
type SignInError = { kind: 'invalidEmail' } | { kind: 'api'; error: unknown } | null

export default function SignIn() {
  const theme = useTheme()
  const router = useRouter()
  const { signIn } = useSession()
  const { locale, preferences, t } = usePreferences()
  const errorMessage = useErrorMessage()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<SignInError>(null)

  const redirectPath =
    typeof redirect === 'string' && redirect.startsWith('/') ? redirect : undefined

  async function requestLink() {
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setError({ kind: 'invalidEmail' })
      return
    }
    setBusy(true)
    setError(null)
    try {
      await unwrap(
        await api.auth['magic-link'].$post({
          json: { email: parsed.data, audience: 'learner', redirectPath, locale },
        }),
      )
      setStep({ kind: 'code', email: parsed.data })
      setCode('')
    } catch (e) {
      setError({ kind: 'api', error: e })
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
        await api.auth.verify.$post({
          json: {
            email: step.email,
            code: value,
            locale,
            localeChosen: isChosen(preferences.locale),
          },
        }),
      )
      await signIn(result.token, result.user)
      router.replace((result.redirectPath ?? redirectPath ?? '/') as never)
    } catch (e) {
      setError({ kind: 'api', error: e })
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  const errorText =
    error === null
      ? null
      : error.kind === 'invalidEmail'
        ? t('learnerAuth.email.invalid')
        : errorMessage(error.error)

  return (
    <Screen maxWidth={520} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ gap: theme.space[6] }}>
        <Logo size="lg" />
        <LanguageSwitch />
        {step.kind === 'email' ? (
          <Card style={{ gap: theme.space[5] }}>
            <View style={{ gap: theme.space[2] }}>
              <Text variant="eyebrow" tone="tertiary">
                {t('learnerAuth.email.eyebrow')}
              </Text>
              <Text variant="h1">{t('learnerAuth.email.title')}</Text>
              <Text tone="secondary">{t('learnerAuth.email.body')}</Text>
            </View>
            <Input
              testID="sign-in-email"
              label={t('learnerAuth.email.label')}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={requestLink}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              textContentType="emailAddress"
              placeholder={t('learnerAuth.email.placeholder')}
              error={errorText}
              returnKeyType="send"
            />
            <Button
              testID="sign-in-request"
              label={t('learnerAuth.email.request')}
              variant="accent"
              size="lg"
              iconRight={ArrowRight}
              loading={busy}
              onPress={requestLink}
              fullWidth
            />
            <Text variant="small" tone="tertiary">
              {t('learnerAuth.email.terms')}
            </Text>
          </Card>
        ) : (
          <Card style={{ gap: theme.space[5] }}>
            <View style={{ gap: theme.space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MailCheck size={20} color={theme.colors.brand} />
                <Text variant="eyebrow" tone="brand">
                  {t('learnerAuth.code.eyebrow')}
                </Text>
              </View>
              <Text variant="h2" testID="sign-in-code-title">
                {t('learnerAuth.code.title')}
              </Text>
              <Text tone="secondary">
                {fillSlots(
                  t(
                    Platform.OS === 'web'
                      ? 'learnerAuth.code.sentToWeb'
                      : 'learnerAuth.code.sentTo',
                  ),
                  { email: <Text variant="bodyStrong">{step.email}</Text> },
                )}
              </Text>
            </View>
            <CodeInput value={code} onChange={setCode} onComplete={verifyCode} error={errorText} />
            <Button
              label={t('learnerAuth.code.verify')}
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
                label={t('learnerAuth.code.changeEmail')}
                variant="ghost"
                size="sm"
                onPress={() => setStep({ kind: 'email' })}
              />
              <Button
                label={t('learnerAuth.code.resend')}
                variant="ghost"
                size="sm"
                onPress={requestLink}
                disabled={busy}
              />
            </View>
          </Card>
        )}
        <Link href="/" asChild>
          <Button label={t('learnerAuth.browse')} variant="ghost" />
        </Link>
      </View>
    </Screen>
  )
}
