import { formatSgd, type LearnerClass, type SeatRefundView } from '@elevate/core'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { useErrorMessage } from '@/lib/api-error'
import {
  classKeys,
  formatClassDay,
  formatClassInstant,
  refundUnfinished,
  type SeatState,
  seatState,
  withdraw,
} from '@/lib/classes'
import { formatDate } from '@/lib/format'
import { usePreferences } from '@/lib/preferences'
import { useTheme } from '@/theme/ThemeProvider'
import { Badge, Button, Card, Text } from '@/ui'

/**
 * The seat on the class screen (docs/designs/scheduled-classes-selling.md, "Withdraw"): what the
 * learner would get back by withdrawing and until when, a move or a changed class, an open manual
 * mark, the latest refund, and for a cancelled class which of its three outcomes applies. Every
 * rule is the API's: this reads `LearnerSeat` and decides nothing about money.
 */
export function ClassSeat({ item }: { item: LearnerClass }) {
  const theme = useTheme()
  const { t } = usePreferences()
  const state = seatState(item)
  const { seat } = item
  const ended = state.kind === 'withdrawn' || state.kind === 'cancelled'

  return (
    <Card style={{ gap: theme.space[3] }} testID="class-seat">
      <Text variant="eyebrow" tone="tertiary">
        {t('learnerClass.seat.title')}
      </Text>
      {!ended && seat.movedAt ? (
        <Text variant="small" testID="class-seat-moved">
          {t('learnerClass.seat.moved')}
        </Text>
      ) : !ended && seat.classChangedAt ? (
        <Text variant="small" testID="class-seat-changed">
          {t('learnerClass.seat.timesChanged')}
        </Text>
      ) : null}
      <SeatBody item={item} state={state} />
    </Card>
  )
}

function SeatBody({ item, state }: { item: LearnerClass; state: SeatState }) {
  const theme = useTheme()
  const { t, locale } = usePreferences()
  const zoned = { timeZone: item.class.timeZone, locale }

  switch (state.kind) {
    case 'withdrawn':
      return (
        <View style={{ gap: theme.space[2] }} testID="class-seat-withdrawn">
          <Text variant="small">{t('learnerClass.refund.withdrawn')}</Text>
          <RefundStatus refund={state.refund} />
        </View>
      )
    case 'cancelled':
      return (
        <View style={{ gap: theme.space[2] }} testID={`class-seat-cancelled-${state.outcome}`}>
          <Text variant="bodyStrong">{t('learnerClass.cancelled.title')}</Text>
          {state.outcome === 'refunded' ? (
            <>
              <Text variant="small">
                {state.part
                  ? t('learnerClass.cancelled.refundPart')
                  : t('learnerClass.cancelled.refundFull')}
              </Text>
              <RefundStatus refund={state.refund} />
            </>
          ) : state.outcome === 'markOpen' ? (
            <Text variant="small">
              {t('learnerClass.cancelled.markOpen', {
                date: formatClassDay(state.until, zoned),
              })}
            </Text>
          ) : (
            <Text variant="small">{t('learnerClass.cancelled.attended')}</Text>
          )}
        </View>
      )
    case 'withdraw':
      return <Withdraw item={item} state={state} />
    case 'refund':
      return <RefundStatus refund={state.refund} />
    case 'markOpen':
      return (
        <Text variant="small" testID="class-seat-mark-open">
          {t('learnerClass.seat.markOpen', { date: formatClassDay(state.until, zoned) })}
        </Text>
      )
    case 'attended':
      return (
        <View style={{ gap: theme.space[2] }}>
          <Text variant="small" testID="class-seat-attended">
            {t('learnerClass.seat.attended')}
          </Text>
          <LatestRefund item={item} />
        </View>
      )
    case 'closed':
      return (
        <View style={{ gap: theme.space[1] }} testID="class-seat-closed">
          <Text variant="bodyStrong">{t('learnerClass.seat.closedTitle')}</Text>
          <Text variant="small" tone="secondary">
            {t('learnerClass.seat.closed')}
          </Text>
          <LatestRefund item={item} />
        </View>
      )
  }
}

/** A refund the teacher gave earlier, which leaves the seat in place. */
function LatestRefund({ item }: { item: LearnerClass }) {
  const refund = item.seat.refund
  return refund && refund.kind === 'discretionary' ? <RefundStatus refund={refund} /> : null
}

/** Where the latest refund stands: on its way, refunded, or ended another way. */
function RefundStatus({ refund }: { refund: SeatRefundView }) {
  const theme = useTheme()
  const { t, locale } = usePreferences()
  const amount = refund.learnerRefundCents
  const lead =
    refund.kind === 'discretionary' ? (
      <Text variant="small">{t('learnerClass.refund.discretionary')}</Text>
    ) : null

  if (refundUnfinished(refund)) {
    return (
      <View style={{ gap: theme.space[1] }} testID="class-refund-on-its-way">
        {lead}
        <View style={{ alignSelf: 'flex-start' }}>
          <Badge label={t('learnerClass.refund.onItsWay')} tone="info" />
        </View>
        <Text variant="small" tone="secondary">
          {amount !== null && amount > 0
            ? t('learnerClass.refund.onItsWayAmount', { amount: formatSgd(amount) })
            : t('learnerClass.refund.onItsWayBody')}
        </Text>
      </View>
    )
  }
  if (refund.status === 'done') {
    return (
      <View style={{ gap: theme.space[1] }} testID="class-refund-done">
        {lead}
        <View style={{ alignSelf: 'flex-start' }}>
          <Badge label={t('learnerClass.refund.refunded')} tone="success" />
        </View>
        {amount !== null && refund.completedAt ? (
          <Text variant="small" tone="secondary">
            {t('learnerClass.refund.refundedBody', {
              amount: formatSgd(amount),
              date: formatDate(refund.completedAt, locale),
            })}
          </Text>
        ) : null}
      </View>
    )
  }
  if (refund.status === 'closed' && refund.closedReason === 'bank_returned') {
    return (
      <Text variant="small" tone="secondary">
        {t('learnerClass.refund.bankReturned')}
      </Text>
    )
  }
  if (refund.status === 'closed' && refund.closedReason === 'support') {
    return (
      <Text variant="small" tone="secondary">
        {t('learnerClass.refund.support')}
      </Text>
    )
  }
  return null
}

/** The amount (or the rate) and the deadline, "Withdraw", and a confirmation step. */
function Withdraw({
  item,
  state,
}: {
  item: LearnerClass
  state: Extract<SeatState, { kind: 'withdraw' }>
}) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { t, locale } = usePreferences()
  const errorMessage = useErrorMessage()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  // Kept as the error object and worded at render, so a language switch rewords it.
  const [error, setError] = useState<unknown>(null)
  const zoned = { timeZone: item.class.timeZone, locale }
  const date = formatClassInstant(state.closesAt, zoned, t)
  const amount = state.amountCents !== null ? formatSgd(state.amountCents) : null

  const offer = state.full
    ? amount
      ? t('learnerClass.seat.withdrawFullAmount', { date, amount })
      : t('learnerClass.seat.withdrawFull', { date })
    : amount
      ? t('learnerClass.seat.withdrawAmount', { date, amount })
      : t('learnerClass.seat.withdrawRate', { date })

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const updated = await withdraw(item.enrollmentId)
      queryClient.setQueryData<LearnerClass[]>(classKeys.mine, (old) =>
        old?.map((c) => (c.enrollmentId === updated.enrollmentId ? updated : c)),
      )
      // The course page's seats changed too.
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'course'] })
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text variant="small" testID="class-seat-withdraw-offer">
        {offer}
      </Text>
      {confirming ? (
        <View style={{ gap: theme.space[2] }} testID="class-seat-confirm">
          <Text variant="bodyStrong">{t('learnerClass.seat.confirmTitle')}</Text>
          <Text variant="small" tone="secondary">
            {t('learnerClass.seat.confirmBody')}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' }}>
            <Button
              testID="class-seat-confirm-withdraw"
              label={t('learnerClass.seat.confirm')}
              variant="danger"
              size="sm"
              loading={busy}
              onPress={confirm}
            />
            <Button
              label={t('learnerClass.seat.keep')}
              variant="ghost"
              size="sm"
              disabled={busy}
              onPress={() => {
                setConfirming(false)
                setError(null)
              }}
            />
          </View>
        </View>
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            testID="class-seat-withdraw"
            label={t('learnerClass.seat.withdraw')}
            variant="secondary"
            size="sm"
            onPress={() => setConfirming(true)}
          />
        </View>
      )}
      {error !== null ? (
        <Text variant="small" tone="danger" testID="class-seat-error">
          {errorMessage(error)}
        </Text>
      ) : null}
    </View>
  )
}
