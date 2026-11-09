import { type Audience, emailSchema } from '@elevate/core'
import { ArrowRight, MailCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Logo } from '../components/Logo'
import { Eyebrow } from '../components/PageHeader'
import { errorMessage, type PortalApi, unwrap } from './api'
import { usePortalAuth } from './auth'

export function SignInPage({
  api,
  audience,
  portalName,
  blurb,
}: {
  api: PortalApi
  audience: Audience
  portalName: string
  blurb: string
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { signIn } = usePortalAuth()
  const redirect = params.get('redirect')
  const redirectPath = redirect?.startsWith('/') ? redirect : undefined
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function request(e?: FormEvent) {
    e?.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) return setError('Enter a valid email address')
    setBusy(true)
    setError(null)
    try {
      await unwrap(
        await api.auth['magic-link'].$post({
          json: { email: parsed.data, audience, redirectPath },
        }),
      )
      setSentTo(parsed.data)
      setCode('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!sentTo) return
    setBusy(true)
    setError(null)
    try {
      const result = await unwrap(await api.auth.verify.$post({ json: { email: sentTo, code } }))
      signIn(result.token, result.user)
      navigate(result.redirectPath ?? redirectPath ?? '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-[460px] space-y-6 animate-rise">
        <Logo size="lg" suffix={portalName.replace(/^Elevate\s*/, '')} />
        {sentTo ? (
          <Card as="section" className="space-y-5">
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-mono text-eyebrow uppercase tracking-[0.08em] text-brand-fg">
                <MailCheck className="size-4" /> Check your inbox
              </p>
              <h1 className="font-display text-h2 font-semibold text-ink">
                Enter the 6-digit code
              </h1>
              <p className="text-body text-ink-secondary">
                We sent a sign-in link and code to{' '}
                <strong className="font-semibold text-ink">{sentTo}</strong>. Click the link, or
                type the code here.
              </p>
            </div>
            <form onSubmit={verify} className="space-y-4">
              <Input
                label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
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
                Verify
              </Button>
            </form>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
                Use a different email
              </Button>
              <Button variant="ghost" size="sm" onClick={() => request()} disabled={busy}>
                Resend
              </Button>
            </div>
          </Card>
        ) : (
          <Card as="section" className="space-y-5">
            <div className="space-y-2">
              <Eyebrow>Sign in</Eyebrow>
              <h1 className="font-display text-h2 font-semibold text-ink">{portalName}</h1>
              <p className="text-body text-ink-secondary">{blurb}</p>
            </div>
            <form onSubmit={request} className="space-y-4">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
                Email me a sign-in code
              </Button>
            </form>
            <p className="text-small text-ink-tertiary">
              One-time link and code, no passwords.{' '}
              <Link to="/" className="text-brand-fg underline-offset-2 hover:underline">
                Back
              </Link>
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
