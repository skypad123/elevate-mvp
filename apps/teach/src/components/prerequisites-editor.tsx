import type { CourseView } from '@elevate/core'
import { Card, CardHeader, EmptyState } from '@elevate/web-ui'
import { useCourseActions } from '../lib/courses'
import { useSaveTracker } from '../lib/save-tracker'
import { CourseMap } from './course-map'

/** Per-lesson prerequisite picker next to a live picture of the resulting graph. */
export function PrerequisitesEditor({ course, locked }: { course: CourseView; locked: boolean }) {
  const actions = useCourseActions(course.id)
  const { track } = useSaveTracker()
  if (course.lessons.length < 2) {
    return (
      <EmptyState
        title="Add at least two lessons"
        body="Prerequisites say which lessons must be completed before another unlocks. With one lesson there is nothing to connect."
      />
    )
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">
        {course.lessons.map((lesson, index) => (
          <Card key={lesson.id} as="section" className="space-y-3">
            <div>
              <p className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-tertiary">
                Lesson {index + 1}
              </p>
              <h3 className="font-semibold text-ink">{lesson.title}</h3>
            </div>
            <fieldset className="space-y-1.5" disabled={locked}>
              <legend className="text-caption text-ink-tertiary">Unlocks after completing:</legend>
              {course.lessons
                .filter((other) => other.id !== lesson.id)
                .map((other) => {
                  const checked = lesson.prerequisiteIds.includes(other.id)
                  return (
                    <label
                      key={other.id}
                      className="flex cursor-pointer items-center gap-2 text-small text-ink"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--brand)]"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...lesson.prerequisiteIds, other.id]
                            : lesson.prerequisiteIds.filter((id) => id !== other.id)
                          void track(actions.setPrerequisites(lesson.id, next)).catch(() => {})
                        }}
                      />
                      {other.title}
                    </label>
                  )
                })}
              {lesson.prerequisiteIds.length === 0 ? (
                <p className="text-caption text-ink-tertiary">Available from the start.</p>
              ) : null}
            </fieldset>
          </Card>
        ))}
      </div>
      <Card as="section">
        <CardHeader
          title="Course map"
          description="Arrows point from a prerequisite to the lesson it unlocks. Loops are rejected when you tick them."
        />
        <CourseMap lessons={course.lessons} />
      </Card>
    </div>
  )
}
