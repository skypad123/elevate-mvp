import { EmptyState, PageHeader } from '@elevate/web-ui'
import { ClipboardCheck, Receipt, Users } from 'lucide-react'

export function ReviewQueue() {
  return (
    <>
      <PageHeader
        eyebrow="Review queue"
        title="Courses awaiting approval"
        description="Approval is the only path to live."
      />
      <EmptyState
        icon={ClipboardCheck}
        title="Queue arrives in Phase 5"
        body="Pending courses with full preview, approve and reject-with-reason."
      />
    </>
  )
}

export function People() {
  return (
    <>
      <PageHeader eyebrow="People" title="Teachers and learners" />
      <EmptyState
        icon={Users}
        title="People arrives in Phase 4"
        body="Teacher applications, commission rates and learner search."
      />
    </>
  )
}

export function Transactions() {
  return (
    <>
      <PageHeader eyebrow="Transactions" title="Payments and payouts" />
      <EmptyState
        icon={Receipt}
        title="Transactions arrive in Phase 8"
        body="Payments list, refunds and the payout ledger."
      />
    </>
  )
}
