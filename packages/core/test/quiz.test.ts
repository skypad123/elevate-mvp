import { describe, expect, it } from 'vitest'
import { gradeQuiz, quizDefinitionSchema, stripAnswers } from '../src/domain/quiz'

const quiz = quizDefinitionSchema.parse({
  passMarkPercent: 70,
  questions: [
    {
      id: 'q1',
      prompt: '2+2?',
      options: [
        { id: 'a', text: '3', correct: false },
        { id: 'b', text: '4', correct: true },
      ],
    },
    {
      id: 'q2',
      prompt: 'Capital of SG?',
      explanation: 'It is a city-state.',
      options: [
        { id: 'a', text: 'Singapore', correct: true },
        { id: 'b', text: 'KL', correct: false },
      ],
    },
    {
      id: 'q3',
      prompt: 'Colour of the sky?',
      options: [
        { id: 'a', text: 'Green', correct: false },
        { id: 'b', text: 'Blue', correct: true },
        { id: 'c', text: 'Red', correct: false },
      ],
    },
  ],
})

describe('quiz', () => {
  it('applies defaults', () => {
    expect(quiz.maxAttempts).toBe(1)
    expect(quiz.timeLimitMinutes).toBeNull()
  })

  it('strips answers and explanations for learners', () => {
    const learner = stripAnswers(quiz)
    expect(JSON.stringify(learner)).not.toContain('correct')
    expect(JSON.stringify(learner)).not.toContain('city-state')
    expect(learner.questions[0]?.options.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('grades at the pass-mark boundary', () => {
    const twoOfThree = gradeQuiz(quiz, { q1: 'b', q2: 'a', q3: 'a' })
    expect(twoOfThree.scorePercent).toBe(67)
    expect(twoOfThree.passed).toBe(false)
    const all = gradeQuiz(quiz, { q1: 'b', q2: 'a', q3: 'b' })
    expect(all.scorePercent).toBe(100)
    expect(all.passed).toBe(true)
    expect(all.perQuestion[1]?.explanation).toBe('It is a city-state.')
    const none = gradeQuiz(quiz, {})
    expect(none.scorePercent).toBe(0)
    expect(none.perQuestion[0]?.selectedOptionId).toBeNull()
  })

  it('rejects questions without exactly one correct option', () => {
    const bad = quizDefinitionSchema.safeParse({
      passMarkPercent: 50,
      questions: [
        {
          id: 'q',
          prompt: 'x',
          options: [
            { id: 'a', text: 'a', correct: true },
            { id: 'b', text: 'b', correct: true },
          ],
        },
      ],
    })
    expect(bad.success).toBe(false)
  })
})
