import type { AttendanceState, LearnerClass } from '@elevate/core'
import type { Locale } from '@elevate/i18n'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, CalendarDays, MapPin, Video } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useErrorMessage } from '@/lib/api-error'
import {
  classKeys,
  disputeMark,
  formatBlockTime,
  formatClassDay,
  useMyClasses,
} from '@/lib/classes'
import { usePreferences } from '@/lib/preferences'
import { useTheme } from '@/theme/ThemeProvider'
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  EmptyState,
  Input,
  Screen,
  Skeleton,
  Text,
} from '@/ui'

type Block = LearnerClass['blocks'][number]

const STATE_TONE: Record<AttendanceState, BadgeTone> = {
  marked_by_hand: 'success',
  present: 'success',
  present_flagged: 'warning',
  mark_voided: 'neutral',
  overturned: 'danger',
  not_arrived: 'neutral',
}

/** States from which the learner can still check in, while the session's window is open. */
const CAN_CHECK_IN: readonly AttendanceState[] = ['not_arrived', 'mark_voided']

/**
 * One class enrolment: the class, each session with the learner's own state, check-in while a
 * session's window is open, and "This was not me" on a manual mark. Part 3 adds materials here.
 */
export default function ClassScreen() {
  const { enrollmentId = '' } = useLocalSearchParams<{ enrollmentId: string }>()
  const theme = useTheme()
  const router = useRouter()
  const { t } = usePreferences()
  const errorMessage = useErrorMessage()
  const classes = useMyClasses(true)
  const item = classes.data?.find((c) => c.enrollmentId === enrollmentId)
  const back = () => router.replace('/learning')

  if (classes.isPending) {
    return (
      <Screen maxWidth={880}>
        <View style={{ gap: theme.space[4] }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={32} />
          <Skeleton height={120} radius={theme.radii.card} />
          <Skeleton height={120} radius={theme.radii.card} />
        </View>
      </Screen>
    )
  }
  if (classes.isError || !item) {
    return (
      <Screen maxWidth={880}>
        <EmptyState
          tone="danger"
          title={t('learnerClass.class.loadError')}
          body={classes.isError ? errorMessage(classes.error) : t('learnerClass.class.notFound')}
          action={{ label: t('learnerClass.class.backToLearning'), onPress: back }}
        />
      </Screen>
    )
  }

  const c = item.class
  return (
    <Screen maxWidth={880}>
      <View style={{ gap: theme.space[6] }}>
        <Link href="/learning" asChild>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          >
            <ArrowLeft size={16} color={theme.colors.inkSecondary} />
            <Text variant="small" tone="secondary">
              {t('learnerClass.class.backToLearning')}
            </Text>
          </Pressable>
        </Link>

        <View style={{ gap: theme.space[2] }}>
          <Text variant="eyebrow" tone="tertiary">
            {t('learnerClass.class.course', { course: c.courseTitle })}
          </Text>
          <Text variant="h1">{c.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            {c.delivery === 'remote' ? (
              <Video size={16} color={theme.colors.inkSecondary} />
            ) : (
              <MapPin size={16} color={theme.colors.inkSecondary} />
            )}
            <Text tone="secondary" style={{ flex: 1 }}>
              {c.delivery === 'remote' || !c.venueAddress
                ? t('learnerClass.class.remote')
                : t('learnerClass.class.venue', { address: c.venueAddress })}
            </Text>
          </View>
        </View>

        <View style={{ gap: theme.space[3] }}>
          <Text variant="h2">{t('learnerClass.class.sessions')}</Text>
          {item.blocks.map((block) => (
            <BlockCard key={block.id} item={item} block={block} />
          ))}
        </View>
      </View>
    </Screen>
  )
}

function BlockCard({ item, block }: { item: LearnerClass; block: Block }) {
  const theme = useTheme()
  const router = useRouter()
  const { t, locale } = usePreferences()
  const zoned = { timeZone: item.class.timeZone, locale }
  const mark = block.state === 'marked_by_hand' ? block.manualMark : null

  return (
    <Card style={{ gap: theme.space[3] }} testID={`class-block-${block.id}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.space[3],
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2], flex: 1 }}>
          <CalendarDays size={16} color={theme.colors.inkSecondary} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {formatBlockTime(block, zoned, t)}
          </Text>
        </View>
        <Badge label={t(`learnerClass.state.${block.state}`)} tone={STATE_TONE[block.state]} />
      </View>

      {block.state === 'present_flagged' && block.flagReason ? (
        <Text variant="small" tone="secondary">
          {t(`learnerClass.flag.${block.flagReason}`)}
        </Text>
      ) : null}

      {block.state === 'overturned' && block.overturn ? (
        <Text variant="small" tone="secondary">
          {t('learnerClass.overturn.title', {
            reason: t(`learnerClass.overturnReason.${block.overturn.reasonCode}`),
          })}
        </Text>
      ) : null}

      {mark ? <MarkDetails item={item} mark={mark} zoned={zoned} /> : null}

      {block.checkInOpen && CAN_CHECK_IN.includes(block.state) ? (
        <Button
          testID={`class-check-in-${block.id}`}
          label={t('learnerClass.class.checkIn')}
          variant="accent"
          onPress={() => router.push(`/class/check-in/${block.id}`)}
        />
      ) : null}
    </Card>
  )
}

function MarkDetails({
  item,
  mark,
  zoned,
}: {
  item: LearnerClass
  mark: NonNullable<Block['manualMark']>
  zoned: { timeZone: string; locale: Locale }
}) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { t } = usePreferences()
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  // Kept as data and worded at render, so a language switch rewords it.
  const [error, setError] = useState<{ kind: 'required' } | { kind: 'api'; error: unknown } | null>(
    null,
  )

  // The instructor's own note says more than "another reason".
  const reason =
    mark.reasonCode === 'other' && mark.reason
      ? mark.reason
      : t(`learnerClass.markReason.${mark.reasonCode}`)

  async function send() {
    const trimmed = note.trim()
    if (!trimmed) {
      setError({ kind: 'required' })
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await disputeMark(mark.eventId, trimmed)
      queryClient.setQueryData<LearnerClass[]>(classKeys.mine, (old) =>
        old?.map((c) => (c.enrollmentId === updated.enrollmentId ? updated : c)),
      )
      setOpen(false)
      setNote('')
    } catch (e) {
      setError({ kind: 'api', error: e })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="small">{t('learnerClass.mark.title', { reason })}</Text>
      <Text variant="small" tone="secondary" testID={`class-mark-${mark.eventId}`}>
        {mark.subState === 'open'
          ? t('learnerClass.subState.open', { date: formatClassDay(mark.disputeUntil, zoned) })
          : t(`learnerClass.subState.${mark.subState}`)}
      </Text>
      {mark.subState === 'open' && !open ? (
        <Button
          testID={`class-dispute-${mark.eventId}`}
          label={t('learnerClass.dispute.action')}
          variant="secondary"
          size="sm"
          onPress={() => setOpen(true)}
        />
      ) : null}
      {mark.subState === 'open' && open ? (
        <View style={{ gap: theme.space[3] }}>
          <Input
            testID={`class-dispute-note-${item.enrollmentId}`}
            label={t('learnerClass.dispute.label')}
            placeholder={t('learnerClass.dispute.placeholder')}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            error={
              error === null
                ? null
                : error.kind === 'required'
                  ? t('learnerClass.dispute.required')
                  : errorMessage(error.error)
            }
          />
          <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
            <Button
              label={t('learnerClass.dispute.submit')}
              variant="primary"
              size="sm"
              loading={busy}
              onPress={send}
            />
            <Button
              label={t('learnerClass.dispute.cancel')}
              variant="ghost"
              size="sm"
              disabled={busy}
              onPress={() => {
                setOpen(false)
                setError(null)
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}
