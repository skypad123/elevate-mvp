import { EmptyState, PageHeader } from '@elevate/web-ui'
import { BookOpen, Wallet } from 'lucide-react'

export function Courses() {
  return (
    <>
      <PageHeader eyebrow="Courses" title="Your courses" />
      <EmptyState
        icon={BookOpen}
        title="No courses yet"
        body="The course builder (lessons, artefacts, prerequisites, quizzes) arrives in the next phase."
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
