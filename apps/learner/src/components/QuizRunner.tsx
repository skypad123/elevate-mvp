import type { ArtefactContentView, LearnerQuiz, QuizAnswers, QuizSubmitResult } from '@elevate/core'
import { CheckCircle2, CircleAlert, Clock, HelpCircle, Trophy, XCircle } from 'lucide-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { errorMessage } from '@/lib/api-error'
import { startQuiz, submitQuiz } from '@/lib/learning'
import { useTheme } from '@/theme/ThemeProvider'
import { Badge, Button, Card, Text } from '@/ui'

type QuizArtefact = Extract<ArtefactContentView, { type: 'quiz' }>
type Phase =
  | { kind: 'intro' }
  | { kind: 'taking'; attemptId: string; quiz: LearnerQuiz; expiresAt: string | null }
  | { kind: 'result'; result: QuizSubmitResult }

function useCountdown(expiresAt: string | null): number | null {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!expiresAt) {
      setLeft(null)
      return
    }
    const tick = () =>
      setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return left
}

export function QuizRunner({
  enrollmentId,
  artefact,
  onUpdated,
}: {
  enrollmentId: string
  artefact: QuizArtefact
  onUpdated: (result: QuizSubmitResult) => void
}) {
  const theme = useTheme()
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const secondsLeft = useCountdown(phase.kind === 'taking' ? phase.expiresAt : null)
  const { attempts } = artefact
  const quizId = artefact.quizId

  const begin = async () => {
    if (!quizId) return
    setBusy(true)
    setError(null)
    try {
      const started = await startQuiz(enrollmentId, quizId)
      setAnswers({})
      setPhase({
        kind: 'taking',
        attemptId: started.attempt.id,
        quiz: started.quiz,
        expiresAt: started.attempt.expiresAt,
      })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (phase.kind !== 'taking' || !quizId) return
    setBusy(true)
    setError(null)
    try {
      const result = await submitQuiz(enrollmentId, quizId, phase.attemptId, answers)
      setPhase({ kind: 'result', result })
      onUpdated(result)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Auto-submit when the time limit runs out; a ref keeps the latest submit without re-running the effect.
  const submitRef = useRef(submit)
  submitRef.current = submit
  useEffect(() => {
    if (phase.kind === 'taking' && secondsLeft === 0 && !busy) void submitRef.current()
  }, [secondsLeft, phase.kind, busy])

  const total = artefact.quiz?.questions.length ?? 0
  const answered = useMemo(
    () => (phase.kind === 'taking' ? phase.quiz.questions.filter((q) => answers[q.id]).length : 0),
    [answers, phase],
  )

  if (!artefact.quiz || !quizId) {
    return (
      <Card muted>
        <Text tone="secondary">This quiz has no questions yet.</Text>
      </Card>
    )
  }

  if (phase.kind === 'intro') {
    const exhausted = !attempts.passed && attempts.used >= attempts.max
    return (
      <Card style={{ gap: theme.space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          {attempts.passed ? (
            <Trophy size={22} color={theme.colors.brand} />
          ) : (
            <HelpCircle size={22} color={theme.colors.brand} />
          )}
          <Text variant="h2">{attempts.passed ? 'Quiz passed' : artefact.title}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
          <Badge label={`${total} question${total === 1 ? '' : 's'}`} />
          <Badge label={`Pass mark ${artefact.quiz.passMarkPercent}%`} tone="brand" />
          <Badge
            label={`${attempts.used}/${attempts.max} attempt${attempts.max === 1 ? '' : 's'} used`}
            tone={exhausted ? 'danger' : 'neutral'}
          />
          {artefact.quiz.timeLimitMinutes ? (
            <Badge label={`${artefact.quiz.timeLimitMinutes} min limit`} tone="warning" />
          ) : null}
        </View>
        {attempts.passed ? (
          <Text tone="secondary">
            You scored {attempts.bestScore}%. This lesson's quiz is complete.
          </Text>
        ) : exhausted ? (
          <Text tone="danger">
            You have used all attempts. Best score: {attempts.bestScore ?? 0}%. Ask your teacher if
            you need another go.
          </Text>
        ) : (
          <>
            <Text tone="secondary">
              Answer every question, then submit.{' '}
              {attempts.max === 1
                ? 'You have a single attempt.'
                : `You can try ${attempts.max - attempts.used} more time${attempts.max - attempts.used === 1 ? '' : 's'}.`}
              {attempts.bestScore !== null ? ` Your best so far is ${attempts.bestScore}%.` : ''}
            </Text>
            <Button
              label={attempts.open ? 'Resume attempt' : 'Start quiz'}
              variant="accent"
              size="lg"
              loading={busy}
              onPress={begin}
            />
          </>
        )}
        {error ? (
          <Text variant="small" tone="danger">
            {error}
          </Text>
        ) : null}
      </Card>
    )
  }

  if (phase.kind === 'taking') {
    return (
      <View style={{ gap: theme.space[4] }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text variant="eyebrow" tone="tertiary">
            {answered} of {phase.quiz.questions.length} answered
          </Text>
          {secondsLeft !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Clock
                size={14}
                color={secondsLeft < 60 ? theme.colors.danger : theme.colors.inkTertiary}
              />
              <Text variant="smallStrong" tone={secondsLeft < 60 ? 'danger' : 'secondary'}>
                {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          ) : null}
        </View>
        {phase.quiz.questions.map((q, i) => (
          <Card key={q.id} style={{ gap: theme.space[3] }}>
            <Text variant="h3">
              {i + 1}. {q.prompt}
            </Text>
            <View style={{ gap: theme.space[2] }}>
              {q.options.map((o) => {
                const selected = answers[q.id] === o.id
                return (
                  <Pressable
                    key={o.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.space[3],
                      padding: theme.space[3],
                      borderRadius: theme.radii.control,
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.brand : theme.colors.border,
                      backgroundColor: selected ? theme.colors.brandTint : theme.colors.surface,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor: selected ? theme.colors.brand : theme.colors.borderStrong,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected ? (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: theme.colors.brand,
                          }}
                        />
                      ) : null}
                    </View>
                    <Text style={{ flex: 1 }}>{o.text}</Text>
                  </Pressable>
                )
              })}
            </View>
          </Card>
        ))}
        {error ? (
          <Text variant="small" tone="danger">
            {error}
          </Text>
        ) : null}
        <Button
          label="Submit answers"
          variant="accent"
          size="lg"
          loading={busy}
          disabled={answered < phase.quiz.questions.length}
          onPress={submit}
        />
      </View>
    )
  }

  const { result } = phase
  return (
    <View style={{ gap: theme.space[4] }}>
      <Card style={{ alignItems: 'center', gap: theme.space[2] }} elevated>
        {result.passed ? (
          <CheckCircle2 size={40} color={theme.colors.success} />
        ) : (
          <CircleAlert size={40} color={theme.colors.warning} />
        )}
        <Text variant="eyebrow" tone={result.passed ? 'success' : 'warning'}>
          {result.passed ? 'Passed' : 'Not yet'}
        </Text>
        <Text variant="display" style={{ fontSize: 48, lineHeight: 52 }}>
          {result.grade.scorePercent}%
        </Text>
        <Text tone="secondary" align="center">
          {result.grade.correctCount} of {result.grade.totalQuestions} correct · pass mark{' '}
          {artefact.quiz.passMarkPercent}%
        </Text>
        {!result.passed && result.attemptsRemaining > 0 ? (
          <Button
            label={`Try again (${result.attemptsRemaining} left)`}
            variant="accent"
            onPress={begin}
            loading={busy}
          />
        ) : null}
        {!result.passed && result.attemptsRemaining === 0 ? (
          <Text tone="danger">No attempts left for this quiz.</Text>
        ) : null}
      </Card>
      <View style={{ gap: theme.space[3] }}>
        {result.grade.perQuestion.map((p, i) => {
          const q = artefact.quiz?.questions.find((x) => x.id === p.questionId)
          const chosen = q?.options.find((o) => o.id === p.selectedOptionId)?.text
          const correct = q?.options.find((o) => o.id === p.correctOptionId)?.text
          return (
            <Card
              key={p.questionId}
              style={{
                gap: 6,
                borderColor: p.correct ? theme.colors.success : theme.colors.danger,
              }}
            >
              <View style={{ flexDirection: 'row', gap: theme.space[2], alignItems: 'flex-start' }}>
                {p.correct ? (
                  <CheckCircle2 size={18} color={theme.colors.success} />
                ) : (
                  <XCircle size={18} color={theme.colors.danger} />
                )}
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {i + 1}. {q?.prompt}
                </Text>
              </View>
              <Text variant="small" tone={p.correct ? 'success' : 'danger'}>
                Your answer: {chosen ?? '—'}
              </Text>
              {!p.correct ? (
                <Text variant="small" tone="secondary">
                  Correct answer: {correct}
                </Text>
              ) : null}
              {p.explanation ? (
                <Text variant="small" tone="secondary">
                  {p.explanation}
                </Text>
              ) : null}
            </Card>
          )
        })}
      </View>
    </View>
  )
}
