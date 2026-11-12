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
  formatDate,
  RichTextView,
  type StatusTone,
  useToast,
} from '@elevate/web-ui'
import { ApiError, errorMessage } from '@elevate/web-ui/portal'
import { Check, CheckCircle2, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useChangeSetActions } from '../lib/change-sets'
import { useCurrentProfile } from '../lib/profile'

const CHANGE: Record<ChangeSetItem['change'], { label: string; tone: StatusTone }> = {
  added: { label: 'Added', tone: 'success' },
  edited: { label: 'Edited', tone: 'info' },
  removed: { label: 'Removed', tone: 'danger' },
}
const KIND: Record<ChangeSetItem['kind'], string> = {
  lesson: 'Lesson',
  artefact: 'Content',
  quiz: 'Quiz questions',
  prerequisites: 'Prerequisites',
}
const ARTEFACT_TYPE: Record<ArtefactView['type'], string> = {
  video: 'Video',
  audio: 'Audio',
  text: 'Reading',
  quiz: 'Quiz',
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
  const [busy, setBusy] = useState<'approve' | 'discard' | string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const canDecide = can('changeSet.review')
  const writer = changeSet.openedBy?.name ?? changeSet.openedBy?.email ?? 'The writer'
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
      toast({ tone: 'danger', title: 'Choose again', description: errorMessage(error) })
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
        title: 'Changes are live',
        description: 'Learners see the updated course now.',
      })
      onDecided()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'change_set_conflict') await actions.refresh()
      toast({ tone: 'danger', title: 'Not approved', description: errorMessage(error) })
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
        title: 'Changes discarded',
        description: 'The course is unchanged.',
      })
      onDecided()
    } catch (error) {
      toast({ tone: 'danger', title: 'Could not discard', description: errorMessage(error) })
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
              title={`${changeSet.conflicts.length} clash${changeSet.conflicts.length === 1 ? '' : 'es'} with the live course`}
              description={`The live course was changed after ${writer} started. For each one, choose which version to keep. Nothing is merged.`}
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
            {changeSet.items.length} change{changeSet.items.length === 1 ? '' : 's'}
          </h2>
          {changeSet.items.length === 0 ? (
            <EmptyState
              title="Nothing has changed yet"
              body={`${writer} started editing this course but has not changed anything. You can discard this, or wait.`}
            />
          ) : (
            changeSet.items.map((item) => (
              <Card
                key={`${item.kind}:${item.draftId ?? item.liveId}`}
                as="article"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={CHANGE[item.change].tone}>{CHANGE[item.change].label}</Badge>
                  <span className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
                    {KIND[item.kind]}
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
            title="Decide"
            description={`Started by ${writer} on ${formatDate(changeSet.openedAt)}. Learners see the course as it was until you approve.`}
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
                Approve and publish
              </Button>
              {unresolved > 0 ? (
                <p className="text-small text-warning">
                  Choose a version for{' '}
                  {unresolved === 1 ? 'the clash' : `each of the ${unresolved} clashes`} before
                  approving.
                </p>
              ) : (
                <p className="text-small text-ink-tertiary">
                  All of these changes go live together. Learners keep their progress on everything
                  that stays.
                </p>
              )}
              <Button
                variant="ghost"
                className="w-full"
                icon={Trash2}
                disabled={busy !== null}
                onClick={() => setConfirmDiscard(true)}
              >
                Discard these changes
              </Button>
            </>
          ) : (
            <p className="text-small text-ink-secondary">
              The owner or a manager approves or discards these changes.
            </p>
          )}
        </Card>
      </div>

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard these changes?"
        description={`Everything ${writer} changed here is thrown away, and they are told by email. The live course is not touched. This cannot be undone.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === 'discard'} onClick={() => void discard()}>
              Discard
            </Button>
          </>
        }
      />
    </div>
  )
}

// ── one change ───────────────────────────────────────────────────────────────

function ItemDetail({ item, before, after }: { item: ChangeSetItem; before: Index; after: Index }) {
  if (item.kind === 'lesson') {
    const was = item.liveId ? before.lessons.get(item.liveId) : undefined
    const now = item.draftId ? after.lessons.get(item.draftId) : undefined
    if (item.change === 'added')
      return (
        <p className="text-small text-ink-secondary">
          A new lesson{now?.summary ? `: ${now.summary}` : ''}. Its content is listed below.
        </p>
      )
    if (item.change === 'removed')
      return (
        <p className="text-small text-ink-secondary">
          The lesson and the {was?.artefacts.length ?? 0} item
          {was?.artefacts.length === 1 ? '' : 's'} in it are removed. Learners lose their progress
          on them.
        </p>
      )
    return (
      <>
        {was && now && was.title !== now.title ? (
          <Compare label="Title" before={was.title} after={now.title} />
        ) : null}
        {was && now && (was.summary ?? '') !== (now.summary ?? '') ? (
          <Compare label="Summary" before={was.summary ?? '—'} after={now.summary ?? '—'} />
        ) : null}
        {was && now && was.position !== now.position ? (
          <Compare
            label="Place in the course"
            before={`Lesson ${was.position + 1}`}
            after={`Lesson ${now.position + 1}`}
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
        ? ids.map((id) => from.lessons.get(id)?.title ?? 'another lesson').join(', ')
        : 'Nothing: open from the start'
    return (
      <Compare
        label="Unlocks after completing"
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
        label="Questions"
        before={<QuizSummary quiz={was?.quiz ?? null} />}
        after={<QuizSummary quiz={now?.quiz ?? null} />}
      />
    )
  if (item.change === 'removed')
    return (
      <p className="text-small text-ink-secondary">
        This {was ? ARTEFACT_TYPE[was.type].toLowerCase() : 'item'} is removed. Learners lose their
        progress on it.
      </p>
    )
  if (item.change === 'added')
    return now ? (
      <div className="space-y-2">
        <p className="text-small text-ink-secondary">
          A new {ARTEFACT_TYPE[now.type].toLowerCase()}.
        </p>
        <ArtefactBody artefact={now} />
      </div>
    ) : null
  return (
    <>
      {was && now && was.title !== now.title ? (
        <Compare label="Title" before={was.title} after={now.title} />
      ) : null}
      {was && now && was.position !== now.position ? (
        <Compare
          label="Place in the lesson"
          before={`Item ${was.position + 1}`}
          after={`Item ${now.position + 1}`}
        />
      ) : null}
      {was && now && (was.media?.id ?? null) !== (now.media?.id ?? null) ? (
        <Compare
          label="File"
          before={was.media?.filename ?? 'No file'}
          after={now.media?.filename ?? 'No file'}
        />
      ) : null}
      {was && now && JSON.stringify(was.contentJson) !== JSON.stringify(now.contentJson) ? (
        <Compare
          label="Text"
          before={<RichTextView doc={was.contentJson} />}
          after={<RichTextView doc={now.contentJson} />}
        />
      ) : null}
    </>
  )
}

/** The live version on the left, the proposed version on the right. */
function Compare({
  label,
  before,
  after,
  afterHeading = 'After approval',
}: {
  label: string
  before: ReactNode
  after: ReactNode
  afterHeading?: string
}) {
  return (
    <div>
      <p className="mb-1.5 text-caption font-semibold text-ink-tertiary">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Side heading="Live now">{before}</Side>
        <Side heading={afterHeading} proposed>
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
  if (artefact.type === 'text')
    return artefact.contentJson ? (
      <div className="rounded-control border border-border bg-surface-muted px-3 py-2 text-small">
        <RichTextView doc={artefact.contentJson} />
      </div>
    ) : (
      <p className="text-small text-ink-tertiary">No text yet.</p>
    )
  if (artefact.type === 'quiz') return <QuizSummary quiz={artefact.quiz} />
  return (
    <p className="text-small text-ink-secondary">
      {artefact.media ? `File: ${artefact.media.filename}` : 'No file uploaded yet.'}
    </p>
  )
}

function QuizSummary({ quiz }: { quiz: QuizDefinition | null }) {
  if (!quiz || quiz.questions.length === 0)
    return <p className="text-small text-ink-tertiary">No questions.</p>
  return (
    <div className="space-y-2">
      <p className="text-caption text-ink-tertiary">
        Pass mark {quiz.passMarkPercent}% · {quiz.maxAttempts} attempt
        {quiz.maxAttempts === 1 ? '' : 's'}
        {quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} min` : ''}
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        {quiz.questions.map((question) => (
          <li key={question.id}>
            <p>{question.prompt}</p>
            <ul className="mt-1 space-y-0.5 text-ink-secondary">
              {question.options.map((option) => (
                <li key={option.id} className="flex items-start gap-1.5">
                  {option.correct ? (
                    <Check
                      aria-label="Correct answer"
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
  const what = conflict.item === 'lesson' ? 'lesson' : conflict.item === 'quiz' ? 'quiz' : 'item'
  let story: string
  let keepLive: string
  let keepDraft: string
  let note: string | null = null
  if (conflict.kind === 'prerequisites') {
    story = `The prerequisites of “${conflict.title}” were changed on the live course, and ${writer} changed them too.`
    keepLive = 'Keep the live prerequisites'
    keepDraft = `Use ${writer}’s prerequisites`
  } else if (conflict.kind === 'deleted') {
    story = `The ${what} “${conflict.title}” was deleted from the live course after ${writer} started.`
    keepLive = 'Leave it deleted'
    keepDraft = `Bring it back, with ${writer}’s changes`
    if (conflict.droppedChildren > 0) {
      note = `Leaving it deleted also drops ${conflict.droppedChildren} new item${conflict.droppedChildren === 1 ? '' : 's'} ${writer} added to it.`
    }
  } else if (isRemoval) {
    story = `${writer} removed the ${what} “${conflict.title}”, and it was edited on the live course after that.`
    keepLive = 'Keep it, as it is live'
    keepDraft = 'Remove it'
  } else {
    story = `The ${what} “${conflict.title}” was edited on the live course after ${writer} started.`
    keepLive = 'Keep the live version'
    keepDraft = `Use ${writer}’s version`
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
        <p className="text-caption text-warning">No choice made yet.</p>
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
  const theirs = `${writer}’s version`
  if (conflict.item === 'lesson') {
    const was = conflict.liveId ? before.lessons.get(conflict.liveId) : undefined
    const now = conflict.draftId ? after.lessons.get(conflict.draftId) : undefined
    if (!was || !now) return null
    const text = (l: LessonView) => (
      <>
        <strong className="font-semibold">{l.title}</strong>
        {l.summary ? <span className="block text-ink-secondary">{l.summary}</span> : null}
        <span className="block text-caption text-ink-tertiary">Lesson {l.position + 1}</span>
      </>
    )
    return (
      <Compare
        label="The two versions"
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
        label="The two versions"
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
    <Compare label="The two versions" before={body(was)} after={body(now)} afterHeading={theirs} />
  )
}
