import { EmptyState, PageHeader } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { BookOpen, Hammer, Settings, Wallet } from 'lucide-react'

export function Dashboard() {
  const { user } = usePortalAuth()
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={
          user?.teacher?.displayName
            ? `Welcome, ${user.teacher.displayName}`
            : 'Welcome to Elevate Teach'
        }
        description="Author courses, submit them for review, and track what you earn."
      />
      <EmptyState
        icon={Hammer}
        eyebrow="Phase 2"
        title="Teacher onboarding arrives next"
        body="The application form, Stripe Connect card and course list land in the following build phases."
      />
    </>
  )
}

export function Courses() {
  return (
    <>
      <PageHeader eyebrow="Courses" title="Your courses" />
      <EmptyState
        icon={BookOpen}
        title="No courses yet"
        body="The course builder (lessons, artefacts, prerequisites, quizzes) arrives in Phase 5."
      />
    </>
  )
}

export function Earnings() {
  return (
    <>
      <PageHeader eyebrow="Earnings" title="Earnings" />
      <EmptyState
        icon={Wallet}
        title="Nothing to report yet"
        body="Gross, Stripe fees, commission and net per course appear here once learners enrol."
      />
    </>
  )
}

export function SettingsPage() {
  const { user } = usePortalAuth()
  return (
    <>
      <PageHeader eyebrow="Settings" title="Account" description={user?.email} />
      <EmptyState
        icon={Settings}
        title="Profile and payouts"
        body="Stripe connection status and your public teacher profile will live here."
      />
    </>
  )
}
