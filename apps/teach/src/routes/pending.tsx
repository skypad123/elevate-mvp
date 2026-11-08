import { Badge, Button, Card, Eyebrow } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { Clock, MailCheck, XCircle } from 'lucide-react'
import { Link } from 'react-router'
import { useTeacherProfile } from '../lib/queries'

export function PendingPage() {
  const { refreshUser } = usePortalAuth()
  const { data: profile, isPending } = useTeacherProfile()
  if (isPending || !profile) return null
  const rejected = profile.status === 'rejected'
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
              The team could not approve your application as submitted. Their note:
            </p>
            <blockquote className="rounded-card border-l-4 border-warning bg-warning-tint p-4 text-body text-ink">
              {profile.reviewNote}
            </blockquote>
            <Link to="/apply">
              <Button variant="accent">Edit and resubmit</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-body text-ink-secondary">
              Thanks, {profile.displayName}. A member of the Elevate team is reading your
              application. You will get an email at{' '}
              <strong className="text-ink">{profile.email}</strong> when it has been reviewed,
              usually within two working days.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/apply">
                <Button variant="secondary">Edit application</Button>
              </Link>
              <Button variant="ghost" icon={MailCheck} onClick={() => refreshUser()}>
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
