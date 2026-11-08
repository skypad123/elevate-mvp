import { EmptyState, PageHeader } from '@elevate/web-ui'
import { Receipt } from 'lucide-react'

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
