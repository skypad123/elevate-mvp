import type { InvitationAccepted, InvitationStatus } from '@elevate/core'
import { Badge, Button, Card, EmptyState, formatDate, Logo, Skeleton } from '@elevate/web-ui'
import { errorMessage, usePortalAuth } from '@elevate/web-ui/portal'
import { PreferencesButton } from '@elevate/web-ui/preferences'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { acceptInvitation, ROLE_LABEL, ROLE_SUMMARY, useInvitationPreview } from '../lib/members'
import { profilePath } from '../lib/urls'

/** Why an invitation that is not waiting any more cannot be used. */
const CLOSED: Record<Exclude<InvitationStatus, 'pending'>, { title: string; body: string }> = {
  expired: {
    title: 'This invitation has expired',
    body: 'Invitations work for 7 days. Ask whoever invited you to send a new one.',
  },
  revoked: {
    title: 'This invitation is no longer valid',
    body: 'It was withdrawn, or replaced by a newer one. Check your inbox for a later email, or ask for a new invitation.',
  },
  accepted: {
    title: 'This invitation was already used',
    body: 'If it was you, the profile is in Elevate Teach under your account.',
  },
  awaiting_confirmation: {
    title: 'Waiting for the owner',
    body: 'This invitation was used from a different address from the one it was sent to. The profile’s owner has been asked to confirm.',
  },
}

/**
 * Where an invitation link lands. It is the one Teach page outside a profile that a signed-out
 * visitor can open: the invitee is not a member yet, and may not have an account yet either.
 * They read who is inviting them and to what, sign in, and accept.
 */
export function InvitationPage() {
  const { token = '' } = useParams()
  const preview = useInvitationPreview(token)
  const { status: session, user, refreshUser, signOut } = usePortalAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<InvitationAccepted | null>(null)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const result = await acceptInvitation(token)
      if (result.status === 'accepted') {
        // The new profile is in the user's list only once the session is read again.
        await refreshUser()
        navigate(profilePath(result.profileId), { replace: true })
        return
      }
      setAccepted(result)
    } catch (e) {
      setError(errorMessage(e))
      void preview.refetch()
    } finally {
      setBusy(false)
    }
  }

  const invitation = preview.data
  return (
    <div className="min-h-full bg-canvas">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-5">
        <Logo size="sm" suffix="Teach" />
        <div className="flex items-center gap-3">
          {user ? <span className="text-small text-ink-secondary">{user.email}</span> : null}
          {/* An invitee may not be signed in, and has no Settings page yet. */}
          <PreferencesButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pb-16">
        {preview.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : preview.isError || !invitation ? (
          <EmptyState
            tone="danger"
            title="Invitation not found"
            body="This link is not a valid invitation. Check that the whole link was copied from the email."
          />
        ) : accepted ? (
          <EmptyState
            icon={MailCheck}
            title="Almost there"
            body={`You accepted the invitation to ${accepted.profileName} from a different address from the one it was sent to. The owner has been asked to confirm that it is you. You will get an email when they do.`}
          />
        ) : invitation.status !== 'pending' ? (
          <EmptyState
            title={CLOSED[invitation.status].title}
            body={CLOSED[invitation.status].body}
            action={
              user ? (
                <Link to="/">
                  <Button variant="secondary">Go to Elevate Teach</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Card as="section" className="space-y-5">
            <div className="space-y-2">
              <Badge tone="brand">Invitation</Badge>
              <h1 className="font-display text-h1 font-semibold text-ink">
                Join {invitation.profileName} as a {ROLE_LABEL[invitation.role].toLowerCase()}
              </h1>
              <p className="text-body text-ink-secondary">
                {invitation.invitedByName ?? 'Someone'} invited you to work on{' '}
                {invitation.profileType === 'corporate' ? 'this company’s' : 'their'} courses on
                Elevate.
              </p>
            </div>
            <p className="rounded-card border border-border bg-surface-muted px-4 py-3 text-small text-ink-secondary">
              <strong className="font-semibold text-ink">{ROLE_LABEL[invitation.role]}.</strong>{' '}
              {ROLE_SUMMARY[invitation.role]}
            </p>
            {error ? (
              <p role="alert" className="text-small text-danger">
                {error}
              </p>
            ) : null}
            {session === 'loading' ? (
              <Skeleton className="h-12 w-full" />
            ) : user ? (
              <div className="space-y-3">
                <Button size="lg" className="w-full" loading={busy} onClick={() => void accept()}>
                  Accept as {user.email}
                </Button>
                <p className="text-small text-ink-tertiary">
                  Not you?{' '}
                  <button
                    type="button"
                    className="font-semibold text-brand-fg hover:underline"
                    onClick={() => void signOut()}
                  >
                    Sign out
                  </button>{' '}
                  and sign in with the address you want to use.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Link to={`/sign-in?redirect=${encodeURIComponent(`/invitations/${token}`)}`}>
                  <Button size="lg" className="w-full">
                    Sign in to accept
                  </Button>
                </Link>
                <p className="text-small text-ink-tertiary">
                  New to Elevate? Signing in with your email creates your account. There is no
                  password to choose.
                </p>
              </div>
            )}
            <p className="text-caption text-ink-tertiary">
              This invitation expires on {formatDate(invitation.expiresAt)}.
            </p>
          </Card>
        )}
      </main>
    </div>
  )
}
