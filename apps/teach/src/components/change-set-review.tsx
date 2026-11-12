import type {
  ArtefactView,
  ChangeSetConflict,
  ChangeSetItem,
  ChangeSetView,
  CourseView,
  LessonView,
  QuizDefinition,
} from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  cn,
  Dialog,
  EmptyState,
  RichTextView,
  type StatusTone,
  useToast,
} from '@elevate/web-ui'
import { ApiError } from '@elevate/web-ui/portal'
import { useErrorMessage, useFormatDate, useFormatList, useT } from '@elevate/web-ui/preferences'
import { Check, CheckCircle2, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useChangeSetActions } from '../lib/change-sets'
import { useCurrentProfile } from '../lib/profile'

/** The colour of each kind of change. Its label is the message `changes.change.<change>`. */
const CHANGE_TONE: Record<ChangeSetItem['change'], StatusTone> = {
  added: 'success',
  edited: 'info',
  removed: 'danger',
}

/** Everything in one version of the course, by ID. */
function index(course: CourseView | undefined) {
  const lessons = new Map<string, LessonView>()
  const artefacts = new Map<string, ArtefactView>()
  for (const lesson of course?.lessons ?? []) {
    lessons.set(lesson.id, lesson)
    for (const artefact of lesson.artefacts) artefacts.set(artefact.id, artefact)
  }
  return { lessons, artefacts }
}
type Index = ReturnType<typeof index>

/**
 * A writer's edits to a live course, for the owner or a manager to decide on. It lists what would
 * change, with the live version beside the proposed one, then every place where the change clashes
 * with an edit made to the live course since, with a choice for each. Approval applies all of it
 * or none of it. Anyone else on the profile sees the same list without the buttons.
 */
export function ChangeSetReview({
  courseId,
  changeSet,
  live,
  draft,
  onDecided,
}: {
  courseId: string
  changeSet: ChangeSetView
  live: CourseView
  draft: CourseView | undefined
  onDecided: () => void
}) {
  const { can } = useCurrentProfile()
  const actions = useChangeSetActions(courseId)
  const { toast } = useToast()
  const t = useT()
  const errorMessage = useErrorMessage()
  const formatDate = useFormatDate()
  const [busy, setBusy] = useState<'approve' | 'discard' | string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const canDecide = can('changeSet.review')
  const writer =
    changeSet.openedBy?.name ?? changeSet.openedBy?.email ?? t('changes.writer.unknown')
  const before = index(live)
  const after = index(draft)
  const unresolved = changeSet.conflicts.filter((c) => c.resolution === null).length
  /** Drafts the writer removed: a clash on one of these is "keep it" against "remove it". */
  const removed = new Set(
    changeSet.items.filter((i) => i.change === 'removed').map((i) => i.draftId),
  )

  async function choose(conflict: ChangeSetConflict, keep: 'live' | 'draft') {
    setBusy(conflict.id)
    try {
      await actions.resolve([{ kind: conflict.kind, id: conflict.id, keep, seen: conflict.seen }])
    } catch (error) {
      // The live course changed again since this list was loaded: show it as it is now.
      await actions.refresh()
      toast({
        tone: 'danger',
        title: t('changes.toast.chooseAgain'),
        description: errorMessage(error),
      })
    } finally {
      setBusy(null)
    }
  }

  async function approve() {
    setBusy('approve')
    try {
      await actions.approve()
      toast({
        tone: 'success',
        title: t('changes.toast.approved'),
        description: t('changes.toast.approved.description'),
      })
      onDecided()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'change_set_conflict') await actions.refresh()
      toast({
        tone: 'danger',
        title: t('changes.toast.approveFailed'),
        description: errorMessage(error),
      })
    } finally {
      setBusy(null)
    }
  }

  async function discard() {
    setBusy('discard')
    try {
      await actions.discard()
      toast({
        tone: 'success',
        title: t('changes.toast.discarded'),
        description: t('changes.toast.discarded.description'),
      })
      onDecided()
    } catch (error) {
      toast({
        tone: 'danger',
        title: t('changes.toast.discardFailed'),
        description: errorMessage(error),
      })
    } finally {
      setBusy(null)
      setConfirmDiscard(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {changeSet.conflicts.length > 0 ? (
          <Card as="section" className="space-y-4 border-warning">
            <CardHeader
              title={t(
                changeSet.conflicts.length === 1
                  ? 'changes.clashes.title.one'
                  : 'changes.clashes.title.other',
                { count: changeSet.conflicts.length },
              )}
              description={t('changes.clashes.description', { writer })}
            />
            {changeSet.conflicts.map((conflict) => (
              <ConflictChoice
                key={`${conflict.kind}:${conflict.id}`}
                conflict={conflict}
                writer={writer}
                isRemoval={conflict.draftId !== null && removed.has(conflict.draftId)}
                before={before}
                after={after}
                disabled={!canDecide || busy !== null}
                onChoose={(keep) => void choose(conflict, keep)}
              />
            ))}
          </Card>
        ) : null}

        <section className="space-y-3">
          <h2 className="font-display text-h3 font-semibold text-ink">
            {t(changeSet.items.length === 1 ? 'changes.count.one' : 'changes.count.other', {
              count: changeSet.items.length,
            })}
          </h2>
          {changeSet.items.length === 0 ? (
            <EmptyState
              title={t('changes.empty.title')}
              body={t('changes.empty.body', { writer })}
            />
          ) : (
            changeSet.items.map((item) => (
              <Card
                key={`${item.kind}:${item.draftId ?? item.liveId}`}
                as="article"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={CHANGE_TONE[item.change]}>
                    {t(`changes.change.${item.change}`)}
                  </Badge>
                  <span className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
                    {t(`changes.kind.${item.kind}`)}
                  </span>
                  <h3 className="font-semibold text-ink">{item.title}</h3>
                </div>
                <ItemDetail item={item} before={before} after={after} />
              </Card>
            ))
          )}
        </section>
      </div>

      <div className="space-y-6">
        <Card as="section" className="space-y-4">
          <CardHeader
            title={t('changes.decide.title')}
            description={t('changes.decide.description', {
              writer,
              date: formatDate(changeSet.openedAt),
            })}
          />
          {canDecide ? (
            <>
              <Button
                size="lg"
                className="w-full"
                icon={CheckCircle2}
                loading={busy === 'approve'}
                disabled={unresolved > 0 || (busy !== null && busy !== 'approve')}
                onClick={() => void approve()}
              >
                {t('changes.decide.approve')}
              </Button>
              {unresolved > 0 ? (
                <p className="text-small text-warning">
                  {t(
                    unresolved === 1
                      ? 'changes.decide.unresolved.one'
                      : 'changes.decide.unresolved.other',
                    { count: unresolved },
                  )}
                </p>
              ) : (
                <p className="text-small text-ink-tertiary">{t('changes.decide.together')}</p>
              )}
              <Button
                variant="ghost"
                className="w-full"
                icon={Trash2}
                disabled={busy !== null}
                onClick={() => setConfirmDiscard(true)}
              >
                {t('changes.decide.discard')}
              </Button>
            </>
          ) : (
            <p className="text-small text-ink-secondary">{t('changes.decide.notAllowed')}</p>
          )}
        </Card>
      </div>

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t('changes.discard.title')}
        description={t('changes.discard.description', { writer })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={busy === 'discard'} onClick={() => void discard()}>
              {t('changes.discard.confirm')}
            </Button>
          </>
        }
      />
    </div>
  )
}

// ── one change ───────────────────────────────────────────────────────────────

function ItemDetail({ item, before, after }: { item: ChangeSetItem; before: Index; after: Index }) {
  const t = useT()
  const formatList = useFormatList()
  if (item.kind === 'lesson') {
    const was = item.liveId ? before.lessons.get(item.liveId) : undefined
    const now = item.draftId ? after.lessons.get(item.draftId) : undefined
    if (item.change === 'added')
      return (
        <p className="text-small text-ink-secondary">
          {now?.summary
            ? // The message ends the summary's sentence itself, so drop a full stop that is already there.
              t('changes.lesson.added.withSummary', { summary: now.summary.replace(/[.。]+$/, '') })
            : t('changes.lesson.added')}
        </p>
      )
    if (item.change === 'removed') {
      const count = was?.artefacts.length ?? 0
      return (
        <p className="text-small text-ink-secondary">
          {t(count === 1 ? 'changes.lesson.removed.one' : 'changes.lesson.removed.other', {
            count,
          })}
        </p>
      )
    }
    return (
      <>
        {was && now && was.title !== now.title ? (
          <Compare label={t('changes.field.title')} before={was.title} after={now.title} />
        ) : null}
        {was && now && (was.summary ?? '') !== (now.summary ?? '') ? (
          <Compare
            label={t('changes.field.summary')}
            before={was.summary ?? '—'}
            after={now.summary ?? '—'}
          />
        ) : null}
        {was && now && was.position !== now.position ? (
          <Compare
            label={t('changes.field.lessonPosition')}
            before={t('changes.position.lesson', { n: was.position + 1 })}
            after={t('changes.position.lesson', { n: now.position + 1 })}
          />
        ) : null}
      </>
    )
  }

  if (item.kind === 'prerequisites') {
    const was = item.liveId ? before.lessons.get(item.liveId) : undefined
    const now = item.draftId ? after.lessons.get(item.draftId) : undefined
    const names = (ids: string[] | undefined, from: Index) =>
      ids?.length
        ? formatList(
            ids.map(
              (id) => from.lessons.get(id)?.title ?? t('changes.prerequisites.unknownLesson'),
            ),
          )
        : t('changes.prerequisites.none')
    return (
      <Compare
        label={t('changes.field.prerequisites')}
        before={names(was?.prerequisiteIds, before)}
        after={names(now?.prerequisiteIds, after)}
      />
    )
  }

  const was = item.liveId ? before.artefacts.get(item.liveId) : undefined
  const now = item.draftId ? after.artefacts.get(item.draftId) : undefined
  if (item.kind === 'quiz')
    return (
      <Compare
        label={t('changes.field.questions')}
        before={<QuizSummary quiz={was?.quiz ?? null} />}
        after={<QuizSummary quiz={now?.quiz ?? null} />}
      />
    )
  if (item.change === 'removed')
    return (
      <p className="text-small text-ink-secondary">
        {was ? t(`changes.item.removed.${was.type}`) : t('changes.item.removed.unknown')}
      </p>
    )
  if (item.change === 'added')
    return now ? (
      <div className="space-y-2">
        <p className="text-small text-ink-secondary">{t(`changes.item.added.${now.type}`)}</p>
        <ArtefactBody artefact={now} />
      </div>
    ) : null
  return (
    <>
      {was && now && was.title !== now.title ? (
        <Compare label={t('changes.field.title')} before={was.title} after={now.title} />
      ) : null}
      {was && now && was.position !== now.position ? (
        <Compare
          label={t('changes.field.itemPosition')}
          before={t('changes.position.item', { n: was.position + 1 })}
          after={t('changes.position.item', { n: now.position + 1 })}
        />
      ) : null}
      {was && now && (was.media?.id ?? null) !== (now.media?.id ?? null) ? (
        <Compare
          label={t('changes.field.file')}
          before={was.media?.filename ?? t('changes.file.none')}
          after={now.media?.filename ?? t('changes.file.none')}
        />
      ) : null}
      {was && now && JSON.stringify(was.contentJson) !== JSON.stringify(now.contentJson) ? (
        <Compare
          label={t('changes.field.text')}
          before={<RichTextView doc={was.contentJson} />}
          after={<RichTextView doc={now.contentJson} />}
        />
      ) : null}
    </>
  )
}

/**
 * The live version on the left, the proposed version on the right. The right side is headed
 * "After approval" unless `afterHeading` says otherwise.
 */
function Compare({
  label,
  before,
  after,
  afterHeading,
}: {
  label: string
  before: ReactNode
  after: ReactNode
  afterHeading?: string
}) {
  const t = useT()
  return (
    <div>
      <p className="mb-1.5 text-caption font-semibold text-ink-tertiary">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Side heading={t('changes.compare.live')}>{before}</Side>
        <Side heading={afterHeading ?? t('changes.compare.afterApproval')} proposed>
          {after}
        </Side>
      </div>
    </div>
  )
}

function Side({
  heading,
  proposed,
  children,
}: {
  heading: string
  proposed?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-control border px-3 py-2 text-small text-ink',
        proposed ? 'border-brand bg-brand-tint/40' : 'border-border bg-surface-muted',
      )}
    >
      <p className="mb-1 font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
        {heading}
      </p>
      <div className="break-words">{children}</div>
    </div>
  )
}

function ArtefactBody({ artefact }: { artefact: ArtefactView }) {
  const t = useT()
  if (artefact.type === 'text')
    return artefact.contentJson ? (
      <div className="rounded-control border border-border bg-surface-muted px-3 py-2 text-small">
        <RichTextView doc={artefact.contentJson} />
      </div>
    ) : (
      <p className="text-small text-ink-tertiary">{t('changes.body.noText')}</p>
    )
  if (artefact.type === 'quiz') return <QuizSummary quiz={artefact.quiz} />
  return (
    <p className="text-small text-ink-secondary">
      {artefact.media
        ? t('changes.body.file', { filename: artefact.media.filename })
        : t('changes.body.noFile')}
    </p>
  )
}

function QuizSummary({ quiz }: { quiz: QuizDefinition | null }) {
  const t = useT()
  if (!quiz || quiz.questions.length === 0)
    return <p className="text-small text-ink-tertiary">{t('changes.quiz.noQuestions')}</p>
  const settings = [
    t('changes.quiz.passMark', { percent: quiz.passMarkPercent }),
    t(quiz.maxAttempts === 1 ? 'changes.quiz.attempts.one' : 'changes.quiz.attempts.other', {
      count: quiz.maxAttempts,
    }),
    ...(quiz.timeLimitMinutes
      ? [t('changes.quiz.timeLimit', { minutes: quiz.timeLimitMinutes })]
      : []),
  ]
  return (
    <div className="space-y-2">
      <p className="text-caption text-ink-tertiary">{settings.join(' · ')}</p>
      <ol className="list-decimal space-y-2 pl-5">
        {quiz.questions.map((question) => (
          <li key={question.id}>
            <p>{question.prompt}</p>
            <ul className="mt-1 space-y-0.5 text-ink-secondary">
              {question.options.map((option) => (
                <li key={option.id} className="flex items-start gap-1.5">
                  {option.correct ? (
                    <Check
                      aria-label={t('changes.quiz.correct')}
                      className="mt-0.5 size-3.5 shrink-0 text-success"
                    />
                  ) : (
                    <span className="inline-block size-3.5 shrink-0" />
                  )}
                  <span className={option.correct ? 'font-semibold text-ink' : undefined}>
                    {option.text}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── one clash ────────────────────────────────────────────────────────────────

function ConflictChoice({
  conflict,
  writer,
  isRemoval,
  before,
  after,
  disabled,
  onChoose,
}: {
  conflict: ChangeSetConflict
  writer: string
  isRemoval: boolean
  before: Index
  after: Index
  disabled: boolean
  onChoose: (keep: 'live' | 'draft') => void
}) {
  const t = useT()
  // Each kind of clash has one message per kind of thing. A clash that names none reads as an item.
  const what = conflict.item ?? 'artefact'
  const { title } = conflict
  let story: string
  let keepLive: string
  let keepDraft: string
  let note: string | null = null
  if (conflict.kind === 'prerequisites') {
    story = t('changes.clash.prerequisites.story', { title, writer })
    keepLive = t('changes.clash.prerequisites.keepLive')
    keepDraft = t('changes.clash.prerequisites.keepDraft', { writer })
  } else if (conflict.kind === 'deleted') {
    story = t(`changes.clash.deleted.story.${what}`, { title, writer })
    keepLive = t('changes.clash.deleted.keepLive')
    keepDraft = t('changes.clash.deleted.keepDraft', { writer })
    if (conflict.droppedChildren > 0) {
      note = t(
        conflict.droppedChildren === 1
          ? 'changes.clash.deleted.dropped.one'
          : 'changes.clash.deleted.dropped.other',
        { count: conflict.droppedChildren, writer },
      )
    }
  } else if (isRemoval) {
    story = t(`changes.clash.removed.story.${what}`, { title, writer })
    keepLive = t('changes.clash.removed.keepLive')
    keepDraft = t('changes.clash.removed.keepDraft')
  } else {
    story = t(`changes.clash.edited.story.${what}`, { title, writer })
    keepLive = t('changes.clash.edited.keepLive')
    keepDraft = t('changes.clash.edited.keepDraft', { writer })
  }

  const name = `conflict-${conflict.kind}-${conflict.id}`
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3 rounded-control border border-border px-4 py-3 disabled:opacity-70"
    >
      <legend className="sr-only">{story}</legend>
      <p className="text-small text-ink">{story}</p>
      {conflict.kind === 'edited' && !isRemoval ? (
        <ConflictVersions conflict={conflict} writer={writer} before={before} after={after} />
      ) : null}
      {note ? <p className="text-small text-warning">{note}</p> : null}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {(
          [
            ['live', keepLive],
            ['draft', keepDraft],
          ] as const
        ).map(([keep, label]) => (
          <label key={keep} className="flex cursor-pointer items-center gap-2 text-small text-ink">
            <input
              type="radio"
              name={name}
              className="size-4 accent-[var(--brand)]"
              checked={conflict.resolution === keep}
              onChange={() => onChoose(keep)}
            />
            {label}
          </label>
        ))}
      </div>
      {conflict.resolution === null ? (
        <p className="text-caption text-warning">{t('changes.clash.noChoice')}</p>
      ) : null}
    </fieldset>
  )
}

/** The two versions of an edited lesson, artefact or quiz, so the choice is an informed one. */
function ConflictVersions({
  conflict,
  writer,
  before,
  after,
}: {
  conflict: ChangeSetConflict
  writer: string
  before: Index
  after: Index
}) {
  const t = useT()
  const theirs = t('changes.versions.theirs', { writer })
  if (conflict.item === 'lesson') {
    const was = conflict.liveId ? before.lessons.get(conflict.liveId) : undefined
    const now = conflict.draftId ? after.lessons.get(conflict.draftId) : undefined
    if (!was || !now) return null
    const text = (l: LessonView) => (
      <>
        <strong className="font-semibold">{l.title}</strong>
        {l.summary ? <span className="block text-ink-secondary">{l.summary}</span> : null}
        <span className="block text-caption text-ink-tertiary">
          {t('changes.position.lesson', { n: l.position + 1 })}
        </span>
      </>
    )
    return (
      <Compare
        label={t('changes.versions.label')}
        before={text(was)}
        after={text(now)}
        afterHeading={theirs}
      />
    )
  }
  const was = conflict.liveId ? before.artefacts.get(conflict.liveId) : undefined
  const now = conflict.draftId ? after.artefacts.get(conflict.draftId) : undefined
  if (!was || !now) return null
  if (conflict.item === 'quiz')
    return (
      <Compare
        label={t('changes.versions.label')}
        before={<QuizSummary quiz={was.quiz} />}
        after={<QuizSummary quiz={now.quiz} />}
        afterHeading={theirs}
      />
    )
  const body = (a: ArtefactView) => (
    <div className="space-y-2">
      <strong className="font-semibold">{a.title}</strong>
      <ArtefactBody artefact={a} />
    </div>
  )
  return (
    <Compare
      label={t('changes.versions.label')}
      before={body(was)}
      after={body(now)}
      afterHeading={theirs}
    />
  )
}
