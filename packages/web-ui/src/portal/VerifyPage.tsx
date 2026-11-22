import { ShieldAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { useT } from '../preferences/PreferencesProvider'
import { type PortalApi, unwrap } from './api'
import { FullPageSpinner, usePortalAuth } from './auth'
import { useSignInErrorMessage } from './sign-in-errors'

/** Why the link failed, worded at render so it follows a language switch. */
type VerifyError = { kind: 'incomplete' } | { kind: 'api'; error: unknown } | null

/**
 * The page the emailed sign-in link opens. It sends no language, so signing in to a portal never
 * changes the account's (ADR 010); the link's `lang` was stored by the pre-paint script.
 */
export function VerifyPage({ api }: { api: PortalApi }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { signIn } = usePortalAuth()
  const t = useT()
  const signInErrorMessage = useSignInErrorMessage()
  const [failure, setFailure] = useState<VerifyError>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = params.get('token')
    const redirect = params.get('redirect')
    if (!token || token.length < 16) return setFailure({ kind: 'incomplete' })
    ;(async () => {
      try {
        const result = await unwrap(await api.auth.verify.$post({ json: { token } }))
        signIn(result.token, result.user)
        navigate(result.redirectPath ?? (redirect?.startsWith('/') ? redirect : '/'), {
          replace: true,
        })
      } catch (err) {
        setFailure({ kind: 'api', error: err })
      }
    })()
  }, [api, params, navigate, signIn])

  if (!failure) return <FullPageSpinner label={t('portalAuth.verify.signingIn')} />
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-4">
      <EmptyState
        icon={ShieldAlert}
        tone="danger"
        eyebrow={t('portalAuth.verify.eyebrow')}
        title={t('portalAuth.verify.title')}
        body={
          failure.kind === 'incomplete'
            ? t('portalAuth.verify.incomplete')
            : signInErrorMessage(failure.error)
        }
      />
      <Button onClick={() => navigate('/sign-in')}>{t('portalAuth.verify.requestNew')}</Button>
      <Link to="/" className="text-center text-small text-ink-secondary hover:text-ink">
        {t('portalAuth.verify.back')}
      </Link>
    </div>
  )
}
