import { type Audience, emailSchema } from '@elevate/core'
import type { MessageKey } from '@elevate/i18n'
import { fillSlots } from '@elevate/i18n/react'
import { ArrowRight, MailCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Logo } from '../components/Logo'
import { Eyebrow } from '../components/PageHeader'
import { PreferencesButton } from '../preferences/PreferencesCard'
import { usePreferences } from '../preferences/PreferencesProvider'
import { type PortalApi, unwrap } from './api'
import { usePortalAuth } from './auth'
import { useSignInErrorMessage } from './sign-in-errors'

/** What went wrong, worded at render so it follows a language switch. */
type SignInError = { kind: 'invalidEmail' } | { kind: 'api'; error: unknown } | null

/**
 * The sign-in page of Teach and Support. It asks for a code in the language on screen, so the
 * code email and its link follow the page; the code check sends no language, so signing in to a
 * portal never changes the account's (ADR 010).
 */
export function SignInPage({
  api,
  audience,
  portalName,
  blurbKey,
}: {
  api: PortalApi
  audience: Audience
  portalName: string
  blurbKey: MessageKey
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { signIn } = usePortalAuth()
  const { t, locale } = usePreferences()
  const signInErrorMessage = useSignInErrorMessage()
  const redirect = params.get('redirect')
  const redirectPath = redirect?.startsWith('/') ? redirect : undefined
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<SignInError>(null)

  const error = !failure
    ? null
    : failure.kind === 'invalidEmail'
      ? t('portalAuth.signIn.invalidEmail')
      : signInErrorMessage(failure.error)

  async function request(e?: FormEvent) {
    e?.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) return setFailure({ kind: 'invalidEmail' })
    setBusy(true)
    setFailure(null)
    try {
      await unwrap(
        await api.auth['magic-link'].$post({
          json: { email: parsed.data, audience, redirectPath, locale },
        }),
      )
      setSentTo(parsed.data)
      setCode('')
    } catch (err) {
      setFailure({ kind: 'api', error: err })
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!sentTo) return
    setBusy(true)
    setFailure(null)
    try {
      const result = await unwrap(await api.auth.verify.$post({ json: { email: sentTo, code } }))
      signIn(result.token, result.user)
      navigate(result.redirectPath ?? redirectPath ?? '/', { replace: true })
    } catch (err) {
      setFailure({ kind: 'api', error: err })
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-[460px] space-y-6 animate-rise">
        <div className="flex items-center justify-between gap-3">
          <Logo size="lg" suffix={portalName.replace(/^Elevate\s*/, '')} />
          {/* Signed out, so Settings can't be reached: pick a language before asking for a code. */}
          <PreferencesButton />
        </div>
        {sentTo ? (
          <Card as="section" className="space-y-5">
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-mono text-eyebrow uppercase tracking-[0.08em] text-brand-fg">
                <MailCheck className="size-4" /> {t('portalAuth.code.eyebrow')}
              </p>
              <h1 className="font-display text-h2 font-semibold text-ink">
                {t('portalAuth.code.title')}
              </h1>
              <p className="text-body text-ink-secondary">
                {fillSlots(t('portalAuth.code.sentTo'), {
                  email: <strong className="font-semibold text-ink">{sentTo}</strong>,
                })}
              </p>
            </div>
            <form onSubmit={verify} className="space-y-4">
              <Input
                label={t('portalAuth.code.label')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t('portalAuth.code.placeholder')}
                className="font-mono text-h3 tracking-[0.3em]"
                error={error}
                autoFocus
              />
              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={busy}
                disabled={code.length !== 6}
              >
                {t('portalAuth.code.verify')}
              </Button>
            </form>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
                {t('portalAuth.code.differentEmail')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => request()} disabled={busy}>
                {t('portalAuth.code.resend')}
              </Button>
            </div>
          </Card>
        ) : (
          <Card as="section" className="space-y-5">
            <div className="space-y-2">
              <Eyebrow>{t('portalAuth.signIn.eyebrow')}</Eyebrow>
              <h1 className="font-display text-h2 font-semibold text-ink">{portalName}</h1>
              <p className="text-body text-ink-secondary">{t(blurbKey)}</p>
            </div>
            <form onSubmit={request} className="space-y-4">
              <Input
                label={t('portalAuth.signIn.emailLabel')}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('portalAuth.signIn.emailPlaceholder')}
                error={error}
                autoFocus
              />
              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                loading={busy}
                iconRight={ArrowRight}
              >
                {t('portalAuth.signIn.request')}
              </Button>
            </form>
            <p className="text-small text-ink-tertiary">
              {fillSlots(t('portalAuth.signIn.noPasswords'), {
                back: (
                  <Link to="/" className="text-brand-fg underline-offset-2 hover:underline">
                    {t('common.back')}
                  </Link>
                ),
              })}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
