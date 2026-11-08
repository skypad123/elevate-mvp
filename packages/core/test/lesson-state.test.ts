import { describe, expect, it } from 'vitest'
import { computeLessonStates } from '../src/domain/lesson-state'

const lessons = [
  { id: 'l1', position: 0, artefactIds: ['a1', 'a2'], prerequisiteIds: [] },
  { id: 'l2', position: 1, artefactIds: ['a3'], prerequisiteIds: ['l1'] },
  { id: 'l3', position: 2, artefactIds: ['a4'], prerequisiteIds: [] },
  { id: 'l4', position: 3, artefactIds: ['a5', 'q1'], prerequisiteIds: ['l2', 'l3'] },
]

const at = (iso: string) => new Date(iso)

describe('computeLessonStates', () => {
  it('starts with prerequisite-free lessons available and the rest locked', () => {
    const r = computeLessonStates(lessons, [])
    expect(r.lessons.map((l) => l.status)).toEqual(['available', 'locked', 'available', 'locked'])
    expect(r.resume).toEqual({ lessonId: 'l1', artefactId: 'a1', positionSeconds: 0 })
    expect(r.isComplete).toBe(false)
    expect(r.percent).toBe(0)
  })

  it('unlocks dependants only when every prerequisite is complete', () => {
    const done = (id: string) => ({
      artefactId: id,
      status: 'completed' as const,
      positionSeconds: 0,
      updatedAt: at('2026-01-01'),
    })
    let r = computeLessonStates(lessons, [done('a1'), done('a2')])
    expect(r.lessons.find((l) => l.id === 'l2')?.status).toBe('available')
    expect(r.lessons.find((l) => l.id === 'l4')?.status).toBe('locked')
    expect(r.lessons.find((l) => l.id === 'l4')?.blockedBy).toEqual(['l2', 'l3'])
    r = computeLessonStates(lessons, [done('a1'), done('a2'), done('a3'), done('a4')])
    expect(r.lessons.find((l) => l.id === 'l4')?.status).toBe('available')
  })

  it('resumes the most recently touched in-progress artefact', () => {
    const r = computeLessonStates(lessons, [
      { artefactId: 'a1', status: 'completed', positionSeconds: 0, updatedAt: at('2026-01-01') },
      { artefactId: 'a2', status: 'in_progress', positionSeconds: 95, updatedAt: at('2026-01-02') },
      { artefactId: 'a4', status: 'in_progress', positionSeconds: 10, updatedAt: at('2026-01-03') },
    ])
    expect(r.resume).toEqual({ lessonId: 'l3', artefactId: 'a4', positionSeconds: 10 })
    expect(r.lessons[0]?.status).toBe('in_progress')
    expect(r.lessons[0]?.percent).toBe(50)
  })

  it('completes the course when every artefact (including the quiz) is complete', () => {
    const all = ['a1', 'a2', 'a3', 'a4', 'a5', 'q1'].map((id) => ({
      artefactId: id,
      status: 'completed' as const,
      positionSeconds: 0,
      updatedAt: at('2026-01-01'),
    }))
    const r = computeLessonStates(lessons, all)
    expect(r.isComplete).toBe(true)
    expect(r.percent).toBe(100)
    expect(r.resume).toBeNull()
    const missingQuiz = computeLessonStates(
      lessons,
      all.filter((p) => p.artefactId !== 'q1'),
    )
    expect(missingQuiz.isComplete).toBe(false)
    expect(missingQuiz.lessons[3]?.status).toBe('in_progress')
  })
})
