import { EmptyState, PageHeader } from '@elevate/web-ui'
import { ClipboardCheck, Receipt } from 'lucide-react'

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
