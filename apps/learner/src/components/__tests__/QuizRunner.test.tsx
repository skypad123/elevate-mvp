import { translate } from '@elevate/i18n'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ComponentProps } from 'react'
import { QuizRunner } from '@/components/QuizRunner'
import { ApiError } from '@/lib/api-error'
import { startQuiz, submitQuiz } from '@/lib/learning'
import { PreferencesProvider } from '@/lib/preferences'
import { ThemeProvider } from '@/theme/ThemeProvider'

jest.mock('@/lib/learning', () => ({ startQuiz: jest.fn(), submitQuiz: jest.fn() }))
const start = startQuiz as jest.Mock
const submit = submitQuiz as jest.Mock

const quiz = {
  passMarkPercent: 50,
  maxAttempts: 3,
  timeLimitMinutes: 1,
  questions: [{ id: 'q1', prompt: 'Which?', options: [{ id: 'a', text: 'A' }] }],
}

const artefact = {
  id: 'art-1',
  type: 'quiz',
  title: 'Timed check',
  durationSeconds: null,
  progress: { status: 'not_started', positionSeconds: 0 },
  quiz,
  quizId: 'quiz-1',
  attempts: { used: 0, max: 3, bestScore: null, passed: false, open: null },
} as unknown as ComponentProps<typeof QuizRunner>['artefact']

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  start.mockResolvedValue({
    attempt: {
      id: 'att-1',
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2_000).toISOString(),
    },
    quiz,
  })
})
afterEach(() => {
  jest.useRealTimers()
})

describe('QuizRunner with a time limit', () => {
  it('submits once when time runs out, and ends an attempt the server says expired', async () => {
    submit.mockRejectedValue(new ApiError(409, 'attempt_expired', 'Time ran out for this attempt'))
    const onAttemptEnded = jest.fn()
    await render(
      <PreferencesProvider>
        <ThemeProvider>
          <QuizRunner
            enrollmentId="enr-1"
            artefact={artefact}
            onUpdated={jest.fn()}
            onAttemptEnded={onAttemptEnded}
          />
        </ThemeProvider>
      </PreferencesProvider>,
    )
    await act(async () => {
      fireEvent.press(screen.getByText(translate('en', 'learnerLearn.quiz.start')))
    })
    expect(start).toHaveBeenCalledTimes(1)
    // The countdown reaches zero; a backgrounded tab can then sit on zero for a long time.
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1_000)
      })
    }
    expect(submit).toHaveBeenCalledTimes(1)
    expect(onAttemptEnded).toHaveBeenCalledTimes(1)
    // Back at the start, saying why.
    expect(screen.getByText(translate('en', 'apiError.attempt_expired'))).toBeTruthy()
    expect(screen.getByText(translate('en', 'learnerLearn.quiz.start'))).toBeTruthy()
  })
})
