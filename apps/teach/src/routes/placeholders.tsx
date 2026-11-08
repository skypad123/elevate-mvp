import { EmptyState, PageHeader } from '@elevate/web-ui'
import { Wallet } from 'lucide-react'

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
