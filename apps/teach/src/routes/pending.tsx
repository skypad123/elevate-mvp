import { Badge, Button, Card, Eyebrow } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { Clock, MailCheck, XCircle } from 'lucide-react'
import { Link } from 'react-router'
import { teachKeys } from '../lib/keys'
import { useCurrentProfile } from '../lib/profile'

/** What a profile shows until Support approves it: its application status. */
export function PendingPage() {
  const { refreshUser } = usePortalAuth()
  const { profile, profileId, actingAsStaff } = useCurrentProfile()
  const queryClient = useQueryClient()
  if (!profile) return null
  const rejected = profile.status === 'rejected'
  // The application form edits the signed-in user's own personal profile.
  const canEdit = !actingAsStaff && profile.type === 'personal'

  async function checkStatus() {
    await refreshUser()
    await queryClient.invalidateQueries({ queryKey: teachKeys.profile(profileId) })
  }

  return (
    <div className="space-y-6 animate-rise">
      <Card as="section" className="space-y-4">
        <div className="flex items-center gap-3">
          {rejected ? (
            <XCircle className="size-7 text-danger" />
          ) : (
            <Clock className="size-7 text-warning" />
          )}
          <div>
            <Eyebrow>Application</Eyebrow>
            <h1 className="font-display text-h1 font-semibold text-ink">
              {rejected ? 'Not approved yet' : 'Under review'}
            </h1>
          </div>
          <Badge tone={rejected ? 'danger' : 'warning'} className="ml-auto">
            {rejected ? 'Rejected' : 'Applied'}
          </Badge>
        </div>
        {rejected ? (
          <>
            <p className="text-body text-ink-secondary">
              The team could not approve the application as submitted. Their note:
            </p>
            <blockquote className="rounded-card border-l-4 border-warning bg-warning-tint p-4 text-body text-ink">
              {profile.reviewNote}
            </blockquote>
            {canEdit ? (
              <Link to="/apply">
                <Button variant="accent">Edit and resubmit</Button>
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-body text-ink-secondary">
              Thanks, {profile.displayName}. A member of the Elevate team is reading the
              application. An email goes to{' '}
              <strong className="text-ink">{profile.owner.email}</strong> when it has been reviewed,
              usually within two working days.
            </p>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Link to="/apply">
                  <Button variant="secondary">Edit application</Button>
                </Link>
              ) : null}
              <Button variant="ghost" icon={MailCheck} onClick={checkStatus}>
                Check status
              </Button>
            </div>
          </>
        )}
      </Card>
      <Card muted className="text-small text-ink-secondary">
        While you wait: think about the first course you want to build. Most pilot teachers start
        with 3–5 lessons, a short video per lesson, a page of notes and a quick quiz.
      </Card>
    </div>
  )
}
