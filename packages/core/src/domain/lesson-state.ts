export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'
export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed'

export type LessonStateInput = {
  id: string
  position: number
  artefactIds: readonly string[]
  prerequisiteIds: readonly string[]
}

export type ArtefactProgressInput = {
  artefactId: string
  status: ProgressStatus
  positionSeconds: number
  updatedAt: Date | string | number
}

export type LessonState = {
  id: string
  status: LessonStatus
  completedArtefacts: number
  totalArtefacts: number
  percent: number
  /** Prerequisite lesson ids that are not yet completed. */
  blockedBy: string[]
}

export type ResumeTarget = { lessonId: string; artefactId: string; positionSeconds: number }

export type CourseProgress = {
  lessons: LessonState[]
  completedLessons: number
  totalLessons: number
  percent: number
  isComplete: boolean
  resume: ResumeTarget | null
}

const toMillis = (value: Date | string | number) =>
  value instanceof Date ? value.getTime() : new Date(value).getTime()

/**
 * Derives lesson lock/complete state from per-artefact progress.
 * A lesson is complete when every artefact is complete (a quiz artefact is only marked complete
 * once passed, so quizzes gate completion for free). A lesson is locked while any prerequisite is
 * incomplete. Lessons with no artefacts can never complete; submission validation prevents them.
 */
export function computeLessonStates(
  lessons: readonly LessonStateInput[],
  progress: readonly ArtefactProgressInput[],
): CourseProgress {
  const byArtefact = new Map(progress.map((p) => [p.artefactId, p]))
  const sorted = [...lessons].sort((a, b) => a.position - b.position)
  const statusOf = (artefactId: string): ProgressStatus =>
    byArtefact.get(artefactId)?.status ?? 'not_started'

  const completed = new Map<string, boolean>()
  for (const lesson of sorted) {
    completed.set(
      lesson.id,
      lesson.artefactIds.length > 0 && lesson.artefactIds.every((a) => statusOf(a) === 'completed'),
    )
  }

  const states: LessonState[] = sorted.map((lesson) => {
    const totalArtefacts = lesson.artefactIds.length
    const completedArtefacts = lesson.artefactIds.filter((a) => statusOf(a) === 'completed').length
    const blockedBy = lesson.prerequisiteIds.filter((p) => !completed.get(p))
    const touched = lesson.artefactIds.some((a) => statusOf(a) !== 'not_started')
    let status: LessonStatus
    if (completed.get(lesson.id)) status = 'completed'
    else if (blockedBy.length > 0) status = 'locked'
    else if (touched) status = 'in_progress'
    else status = 'available'
    return {
      id: lesson.id,
      status,
      completedArtefacts,
      totalArtefacts,
      percent: totalArtefacts ? Math.round((completedArtefacts / totalArtefacts) * 100) : 0,
      blockedBy,
    }
  })

  const totalLessons = states.length
  const completedLessons = states.filter((s) => s.status === 'completed').length
  const isComplete = totalLessons > 0 && completedLessons === totalLessons
  const percent = totalLessons
    ? Math.round(states.reduce((sum, s) => sum + s.percent, 0) / totalLessons)
    : 0

  const open = new Set(
    states.filter((s) => s.status === 'available' || s.status === 'in_progress').map((s) => s.id),
  )
  const lessonOfArtefact = new Map<string, string>()
  for (const lesson of sorted)
    for (const a of lesson.artefactIds) lessonOfArtefact.set(a, lesson.id)

  let resume: ResumeTarget | null = null
  const inProgress = progress
    .filter((p) => p.status === 'in_progress')
    .map((p) => ({ p, lessonId: lessonOfArtefact.get(p.artefactId) }))
    .filter(
      (x): x is { p: ArtefactProgressInput; lessonId: string } =>
        x.lessonId !== undefined && open.has(x.lessonId),
    )
    .sort((a, b) => toMillis(b.p.updatedAt) - toMillis(a.p.updatedAt))
  const latest = inProgress[0]
  if (latest) {
    resume = {
      lessonId: latest.lessonId,
      artefactId: latest.p.artefactId,
      positionSeconds: latest.p.positionSeconds,
    }
  } else {
    const nextLesson = sorted.find((l) => open.has(l.id))
    const artefactId =
      nextLesson?.artefactIds.find((a) => statusOf(a) !== 'completed') ?? nextLesson?.artefactIds[0]
    if (nextLesson && artefactId)
      resume = { lessonId: nextLesson.id, artefactId, positionSeconds: 0 }
  }

  return { lessons: states, completedLessons, totalLessons, percent, isComplete, resume }
}
