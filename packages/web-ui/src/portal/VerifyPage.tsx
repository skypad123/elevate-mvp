import { ShieldAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { errorMessage, type PortalApi, unwrap } from './api'
import { FullPageSpinner, usePortalAuth } from './auth'

export function VerifyPage({ api }: { api: PortalApi }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { signIn } = usePortalAuth()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = params.get('token')
    const redirect = params.get('redirect')
    if (!token || token.length < 16)
      return setError('This sign-in link is incomplete. Request a new one.')
    ;(async () => {
      try {
        const result = await unwrap(await api.auth.verify.$post({ json: { token } }))
        signIn(result.token, result.user)
        navigate(result.redirectPath ?? (redirect?.startsWith('/') ? redirect : '/'), {
          replace: true,
        })
      } catch (err) {
        setError(errorMessage(err))
      }
    })()
  }, [api, params, navigate, signIn])

  if (!error) return <FullPageSpinner label="Signing you in…" />
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-4">
      <EmptyState
        icon={ShieldAlert}
        tone="danger"
        eyebrow="Sign-in link"
        title="We could not sign you in"
        body={error}
      />
      <Button onClick={() => navigate('/sign-in')}>Request a new link</Button>
      <Link to="/" className="text-center text-small text-ink-secondary hover:text-ink">
        Back to start
      </Link>
    </div>
  )
}
