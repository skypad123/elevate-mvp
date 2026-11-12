import type { InvitationAccepted } from '@elevate/core'
import { Badge, Button, Card, EmptyState, Logo, Skeleton } from '@elevate/web-ui'
import { errorMessage, usePortalAuth } from '@elevate/web-ui/portal'
import { fillSlots, PreferencesButton, useFormatDate, useT } from '@elevate/web-ui/preferences'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { acceptInvitation, useInvitationPreview } from '../lib/members'
import { profilePath } from '../lib/urls'

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
  const t = useT()
  const formatDate = useFormatDate()
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
            title={t('invitation.notFound.title')}
            body={t('invitation.notFound.body')}
          />
        ) : accepted ? (
          <EmptyState
            icon={MailCheck}
            title={t('invitation.almostThere.title')}
            body={t('invitation.almostThere.body', { profile: accepted.profileName })}
          />
        ) : invitation.status !== 'pending' ? (
          // Why an invitation that is not waiting any more cannot be used.
          <EmptyState
            title={t(`invitation.closed.${invitation.status}.title`)}
            body={t(`invitation.closed.${invitation.status}.body`)}
            action={
              user ? (
                <Link to="/">
                  <Button variant="secondary">{t('invitation.goToTeach')}</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Card as="section" className="space-y-5">
            <div className="space-y-2">
              <Badge tone="brand">{t('invitation.badge')}</Badge>
              <h1 className="font-display text-h1 font-semibold text-ink">
                {t(`invitation.join.${invitation.role}`, { profile: invitation.profileName })}
              </h1>
              <p className="text-body text-ink-secondary">
                {invitation.invitedByName
                  ? t(`invitation.invitedBy.${invitation.profileType}`, {
                      name: invitation.invitedByName,
                    })
                  : t(`invitation.invitedBy.someone.${invitation.profileType}`)}
              </p>
            </div>
            <p className="rounded-card border border-border bg-surface-muted px-4 py-3 text-small text-ink-secondary">
              {fillSlots(t('profileRole.note'), {
                role: (
                  <strong className="font-semibold text-ink">
                    {t(`profileRole.${invitation.role}`)}
                  </strong>
                ),
                summary: t(`profileRole.${invitation.role}.summary`),
              })}
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
                  {t('invitation.accept', { email: user.email })}
                </Button>
                <p className="text-small text-ink-tertiary">
                  {fillSlots(t('invitation.notYou'), {
                    signOut: (
                      <button
                        type="button"
                        className="font-semibold text-brand-fg hover:underline"
                        onClick={() => void signOut()}
                      >
                        {t('nav.signOut')}
                      </button>
                    ),
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Link to={`/sign-in?redirect=${encodeURIComponent(`/invitations/${token}`)}`}>
                  <Button size="lg" className="w-full">
                    {t('invitation.signInToAccept')}
                  </Button>
                </Link>
                <p className="text-small text-ink-tertiary">{t('invitation.newHere')}</p>
              </div>
            )}
            <p className="text-caption text-ink-tertiary">
              {t('invitation.expires', { date: formatDate(invitation.expiresAt) })}
            </p>
          </Card>
        )}
      </main>
    </div>
  )
}
