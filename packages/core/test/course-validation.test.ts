import { describe, expect, it } from 'vitest'
import { validateCourseForSubmission } from '../src/domain/course-validation'

const base = {
  title: 'Sourdough from scratch',
  summary: 'A hands-on course covering starters, shaping and baking at home.',
  category: 'food-drink',
  priceCents: 8900,
  hasThumbnail: true,
  hasDescription: true,
  teacherStripeChargesEnabled: true,
  prerequisites: [],
  lessons: [
    {
      id: 'l1',
      title: 'Starter',
      artefacts: [
        { id: 'a1', type: 'video' as const, title: 'Intro', mediaStatus: 'ready' as const },
      ],
    },
    {
      id: 'l2',
      title: 'Shaping',
      artefacts: [
        { id: 'a2', type: 'text' as const, title: 'Notes', hasContent: true },
        { id: 'a3', type: 'quiz' as const, title: 'Check', quizQuestionCount: 3 },
      ],
    },
  ],
}

describe('validateCourseForSubmission', () => {
  it('passes a complete course', () => {
    expect(validateCourseForSubmission(base)).toEqual({ ok: true, problems: [] })
  })
  it('lists every problem with its location', () => {
    const r = validateCourseForSubmission({
      ...base,
      priceCents: 20,
      hasThumbnail: false,
      teacherStripeChargesEnabled: false,
      lessons: [
        {
          id: 'l1',
          title: 'Starter',
          artefacts: [{ id: 'a1', type: 'video', title: 'Intro', mediaStatus: 'processing' }],
        },
        { id: 'l2', title: 'Empty', artefacts: [] },
        {
          id: 'l3',
          title: 'Quiz',
          artefacts: [{ id: 'a9', type: 'quiz', title: 'Q', quizQuestionCount: 0 }],
        },
      ],
      prerequisites: [{ lessonId: 'l1', prerequisiteId: 'l1' }],
    })
    expect(r.ok).toBe(false)
    expect(r.problems.map((p) => p.code).sort()).toEqual(
      [
        'empty_lesson',
        'empty_quiz',
        'media_not_ready',
        'prerequisites',
        'price',
        'stripe',
        'thumbnail',
      ].sort(),
    )
    expect(r.problems.find((p) => p.code === 'media_not_ready')).toMatchObject({
      lessonId: 'l1',
      artefactId: 'a1',
    })
  })
})
