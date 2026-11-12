import type { ArtefactView, CourseView, LessonView } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  cn,
  Dialog,
  EmptyState,
  Input,
  MediaUploader,
  RichTextEditor,
  statusLabel,
  statusTone,
  Textarea,
} from '@elevate/web-ui'
import { FileAudio, FileText, Film, HelpCircle, type LucideIcon, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { type CourseActions, stableId, uploadInlineImage, useCourseActions } from '../lib/courses'
import { useCurrentProfile } from '../lib/profile'
import { useSaveTracker } from '../lib/save-tracker'
import { useDebounced } from '../lib/use-debounced'
import { QuizEditor } from './quiz-editor'
import { SortableList } from './sortable-list'

const ARTEFACT_META: Record<
  ArtefactView['type'],
  { icon: LucideIcon; label: string; defaultTitle: string }
> = {
  video: { icon: Film, label: 'Video', defaultTitle: 'New video' },
  audio: { icon: FileAudio, label: 'Audio', defaultTitle: 'New audio' },
  text: { icon: FileText, label: 'Text', defaultTitle: 'New reading' },
  quiz: { icon: HelpCircle, label: 'Quiz', defaultTitle: 'Quick check' },
}

export function CurriculumEditor({ course, locked }: { course: CourseView; locked: boolean }) {
  const actions = useCourseActions(course.id)
  const { track } = useSaveTracker()
  // What is selected is remembered by `stableId`, not by `id`: a writer's first edit to a live
  // course swaps every item for its draft copy, and the selection has to survive that.
  const firstLesson = course.lessons[0]
  const [lessonKey, setLessonKey] = useState<string | null>(
    firstLesson ? stableId(firstLesson) : null,
  )
  const [artefactKey, setArtefactKey] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    kind: 'lesson' | 'artefact'
    id: string
    key: string
    title: string
  } | null>(null)

  useEffect(() => {
    if (lessonKey && !course.lessons.some((l) => stableId(l) === lessonKey)) {
      const first = course.lessons[0]
      setLessonKey(first ? stableId(first) : null)
    }
  }, [course.lessons, lessonKey])
  const lesson = course.lessons.find((l) => stableId(l) === lessonKey) ?? null
  const artefact = lesson?.artefacts.find((a) => stableId(a) === artefactKey) ?? null

  const addLesson = async () => {
    const next = await track(actions.addLesson(`Lesson ${course.lessons.length + 1}`))
    const created = next.lessons.at(-1)
    if (created) {
      setLessonKey(stableId(created))
      setArtefactKey(null)
    }
  }
  const addArtefact = async (type: ArtefactView['type']) => {
    if (!lesson) return
    const next = await track(actions.addArtefact(lesson.id, type, ARTEFACT_META[type].defaultTitle))
    const created = next.lessons.find((l) => stableId(l) === stableId(lesson))?.artefacts.at(-1)
    if (created) setArtefactKey(stableId(created))
  }
  const remove = async () => {
    if (!confirm) return
    if (confirm.kind === 'lesson') {
      await track(actions.deleteLesson(confirm.id))
      if (lessonKey === confirm.key) setLessonKey(null)
    } else {
      await track(actions.deleteArtefact(confirm.id))
      if (artefactKey === confirm.key) setArtefactKey(null)
    }
    setConfirm(null)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1.35fr)]">
      {/* lessons */}
      <Card padded={false} className="flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-small-strong font-semibold text-ink">Lessons</h2>
          <Button size="sm" variant="ghost" icon={Plus} disabled={locked} onClick={addLesson}>
            Add
          </Button>
        </div>
        <div className="p-2">
          {course.lessons.length === 0 ? (
            <p className="p-3 text-small text-ink-tertiary">
              Add your first lesson. Each lesson is an ordered set of videos, readings and quizzes.
            </p>
          ) : (
            <SortableList
              items={course.lessons}
              disabled={locked}
              onReorder={(ids) => void track(actions.reorderLessons(ids))}
              renderItem={(l, handle) => (
                <div
                  className={cn(
                    'group flex items-center gap-1 rounded-control border px-1 py-1.5 transition-colors',
                    stableId(l) === lessonKey
                      ? 'border-brand bg-brand-tint/50'
                      : 'border-transparent hover:bg-surface-muted',
                  )}
                >
                  {handle}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setLessonKey(stableId(l))
                      setArtefactKey(null)
                    }}
                  >
                    <p className="truncate text-small font-semibold text-ink">{l.title}</p>
                    <p className="text-caption text-ink-tertiary">
                      {l.artefacts.length} item{l.artefacts.length === 1 ? '' : 's'}
                      {l.prerequisiteIds.length
                        ? ` · ${l.prerequisiteIds.length} prerequisite${l.prerequisiteIds.length === 1 ? '' : 's'}`
                        : ''}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label="Delete lesson"
                    disabled={locked}
                    onClick={() =>
                      setConfirm({ kind: 'lesson', id: l.id, key: stableId(l), title: l.title })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            />
          )}
        </div>
      </Card>

      {/* artefact timeline */}
      <Card padded={false} className="flex min-w-0 flex-col">
        {lesson ? (
          <>
            <div className="space-y-3 border-b border-border p-4">
              <LessonFields
                key={stableId(lesson)}
                lesson={lesson}
                actions={actions}
                locked={locked}
              />
            </div>
            <div className="flex-1 p-3">
              <p className="mb-2 px-1 font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
                Timeline
              </p>
              {lesson.artefacts.length === 0 ? (
                <p className="px-1 pb-3 text-small text-ink-tertiary">
                  Nothing here yet. Add a video, a reading or a quiz below.
                </p>
              ) : (
                <SortableList
                  items={lesson.artefacts}
                  disabled={locked}
                  onReorder={(ids) => void track(actions.reorderArtefacts(lesson.id, ids))}
                  renderItem={(a, handle) => {
                    const Icon = ARTEFACT_META[a.type].icon
                    return (
                      <div
                        className={cn(
                          'group flex items-center gap-1 rounded-control border px-1 py-1.5',
                          stableId(a) === artefactKey
                            ? 'border-brand bg-brand-tint/50'
                            : 'border-transparent hover:bg-surface-muted',
                        )}
                      >
                        {handle}
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => setArtefactKey(stableId(a))}
                        >
                          <Icon className="size-4 shrink-0 text-brand" />
                          <span className="truncate text-small font-semibold text-ink">
                            {a.title}
                          </span>
                          {a.media ? (
                            <Badge tone={statusTone[a.media.status]}>
                              {statusLabel(a.media.status)}
                            </Badge>
                          ) : null}
                          {a.type === 'quiz' ? (
                            <Badge>{a.quiz?.questions.length ?? 0} q</Badge>
                          ) : null}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          aria-label="Delete item"
                          disabled={locked}
                          onClick={() =>
                            setConfirm({
                              kind: 'artefact',
                              id: a.id,
                              key: stableId(a),
                              title: a.title,
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )
                  }}
                />
              )}
            </div>
            <div className="grid grid-cols-4 gap-1 border-t border-border p-2">
              {(Object.keys(ARTEFACT_META) as ArtefactView['type'][]).map((type) => {
                const meta = ARTEFACT_META[type]
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={locked}
                    onClick={() => void addArtefact(type)}
                    className="flex flex-col items-center gap-1 rounded-control px-2 py-2 text-caption font-semibold text-ink-secondary transition-colors hover:bg-brand-tint hover:text-brand disabled:opacity-50"
                  >
                    <meta.icon className="size-4" /> {meta.label}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState
            title="Pick a lesson"
            body="Select a lesson on the left, or add one."
            className="m-3 py-10"
          />
        )}
      </Card>

      {/* editor */}
      <Card className="min-w-0">
        {artefact ? (
          <ArtefactEditor
            key={stableId(artefact)}
            artefact={artefact}
            actions={actions}
            locked={locked}
          />
        ) : (
          <EmptyState
            title={lesson ? 'Pick an item to edit' : 'Nothing selected'}
            body={
              lesson
                ? 'Choose something in the timeline, or add a new item.'
                : 'Lessons appear on the left.'
            }
            className="py-16"
          />
        )}
      </Card>

      <Dialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${confirm?.kind === 'lesson' ? 'lesson' : 'item'}?`}
        description={`“${confirm?.title ?? ''}” ${confirm?.kind === 'lesson' ? 'and everything in it will be removed.' : 'will be removed.'} This cannot be undone.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  )
}

function LessonFields({
  lesson,
  actions,
  locked,
}: {
  lesson: LessonView
  actions: CourseActions
  locked: boolean
}) {
  const { track } = useSaveTracker()
  const [title, setTitle] = useState(lesson.title)
  const [summary, setSummary] = useState(lesson.summary ?? '')
  // Merge rapid edits across both fields so a title change is not dropped by a summary change.
  const pending = useRef<{ title?: string; summary?: string | null }>({})
  const flush = useDebounced(() => {
    const patch = pending.current
    pending.current = {}
    if (Object.keys(patch).length) void track(actions.updateLesson(lesson.id, patch))
  }, 700)
  const queue = (patch: { title?: string; summary?: string | null }) => {
    pending.current = { ...pending.current, ...patch }
    flush()
  }
  return (
    <>
      <Input
        label="Lesson title"
        value={title}
        disabled={locked}
        onChange={(e) => {
          setTitle(e.target.value)
          if (e.target.value.trim()) queue({ title: e.target.value.trim() })
        }}
      />
      <Textarea
        label="What learners will be able to do"
        rows={2}
        value={summary}
        disabled={locked}
        placeholder="One or two sentences."
        onChange={(e) => {
          setSummary(e.target.value)
          queue({ summary: e.target.value.trim() || null })
        }}
      />
    </>
  )
}

function ArtefactEditor({
  artefact,
  actions,
  locked,
}: {
  artefact: ArtefactView
  actions: CourseActions
  locked: boolean
}) {
  const { track } = useSaveTracker()
  const { profileId } = useCurrentProfile()
  const [title, setTitle] = useState(artefact.title)
  const [quizSaving, setQuizSaving] = useState(false)
  const saveTitle = useDebounced(
    (value: string) => void track(actions.updateArtefact(artefact.id, { title: value })),
    700,
  )
  const saveContent = (doc: Parameters<typeof actions.updateArtefact>[1]['contentJson']) =>
    void track(actions.updateArtefact(artefact.id, { contentJson: doc }))
  const meta = ARTEFACT_META[artefact.type]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <meta.icon className="size-5 text-brand" />
        <p className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
          {meta.label}
        </p>
      </div>
      <Input
        label="Title"
        value={title}
        disabled={locked}
        onChange={(e) => {
          setTitle(e.target.value)
          if (e.target.value.trim()) saveTitle(e.target.value.trim())
        }}
      />
      {artefact.type === 'video' || artefact.type === 'audio' ? (
        <MediaUploader
          api={api}
          profileId={profileId}
          kind={artefact.type}
          value={artefact.media}
          disabled={locked}
          label={artefact.type === 'video' ? 'Video file' : 'Audio file'}
          hint={
            artefact.type === 'video'
              ? 'MP4, MOV or WebM. Transcoding starts automatically.'
              : 'MP3, M4A or WAV.'
          }
          onChange={(asset) =>
            void track(actions.updateArtefact(artefact.id, { mediaAssetId: asset?.id ?? null }))
          }
        />
      ) : null}
      {artefact.type === 'text' ? (
        <RichTextEditor
          value={artefact.contentJson}
          disabled={locked}
          placeholder="Write the lesson text. Headings, lists, links and images are supported."
          onChange={saveContent}
          onPickImage={() => uploadInlineImage(profileId)}
          minHeight={320}
        />
      ) : null}
      {artefact.type === 'quiz' ? (
        <QuizEditor
          value={artefact.quiz}
          disabled={locked}
          saving={quizSaving}
          onSave={async (quiz) => {
            setQuizSaving(true)
            try {
              await track(actions.saveQuiz(artefact.id, quiz))
            } finally {
              setQuizSaving(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}
