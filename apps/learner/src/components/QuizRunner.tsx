import type { ArtefactContentView, LearnerQuiz, QuizAnswers, QuizSubmitResult } from '@elevate/core'
import type { Translator } from '@elevate/i18n'
import { CheckCircle2, CircleAlert, Clock, HelpCircle, Trophy, XCircle } from 'lucide-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useErrorMessage } from '@/lib/api-error'
import { startQuiz, submitQuiz } from '@/lib/learning'
import { usePreferences } from '@/lib/preferences'
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

/** The instructions before an attempt: one whole message for each case. */
function introText(
  t: Translator,
  attempts: Pick<QuizArtefact['attempts'], 'max' | 'used' | 'bestScore'>,
): string {
  const best = attempts.bestScore
  if (attempts.max === 1) {
    return best !== null
      ? t('learnerLearn.quiz.intro.single.best', { score: best })
      : t('learnerLearn.quiz.intro.single')
  }
  const count = attempts.max - attempts.used
  if (best !== null) {
    return t(
      count === 1
        ? 'learnerLearn.quiz.intro.more.one.best'
        : 'learnerLearn.quiz.intro.more.other.best',
      { count, score: best },
    )
  }
  return t(
    count === 1 ? 'learnerLearn.quiz.intro.more.one' : 'learnerLearn.quiz.intro.more.other',
    {
      count,
    },
  )
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
  const { t } = usePreferences()
  const errorMessage = useErrorMessage()
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [busy, setBusy] = useState(false)
  // The failed request itself, worded at render so a language switch rewords it.
  const [error, setError] = useState<{ error: unknown } | null>(null)
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
      setError({ error: e })
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
      setError({ error: e })
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
        <Text tone="secondary">{t('learnerLearn.quiz.noQuestions')}</Text>
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
          <Text variant="h2">
            {attempts.passed ? t('learnerLearn.quiz.passed.title') : artefact.title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
          <Badge
            label={t(
              total === 1 ? 'learnerLearn.quiz.questions.one' : 'learnerLearn.quiz.questions.other',
              { count: total },
            )}
          />
          <Badge
            label={t('learnerLearn.quiz.passMark', { percent: artefact.quiz.passMarkPercent })}
            tone="brand"
          />
          <Badge
            label={t(
              attempts.max === 1
                ? 'learnerLearn.quiz.attemptsUsed.one'
                : 'learnerLearn.quiz.attemptsUsed.other',
              { used: attempts.used, max: attempts.max },
            )}
            tone={exhausted ? 'danger' : 'neutral'}
          />
          {artefact.quiz.timeLimitMinutes ? (
            <Badge
              label={t('learnerLearn.quiz.timeLimit', {
                minutes: artefact.quiz.timeLimitMinutes,
              })}
              tone="warning"
            />
          ) : null}
        </View>
        {attempts.passed ? (
          <Text tone="secondary">
            {t('learnerLearn.quiz.passedBody', { score: attempts.bestScore ?? 0 })}
          </Text>
        ) : exhausted ? (
          <Text tone="danger">
            {t('learnerLearn.quiz.exhausted', { score: attempts.bestScore ?? 0 })}
          </Text>
        ) : (
          <>
            <Text tone="secondary">{introText(t, attempts)}</Text>
            <Button
              label={
                attempts.open ? t('learnerLearn.quiz.resumeAttempt') : t('learnerLearn.quiz.start')
              }
              variant="accent"
              size="lg"
              loading={busy}
              onPress={begin}
            />
          </>
        )}
        {error ? (
          <Text variant="small" tone="danger">
            {errorMessage(error.error)}
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
            {t('learnerLearn.quiz.answered', { answered, total: phase.quiz.questions.length })}
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
              {t('learnerLearn.numbered', { number: i + 1, title: q.prompt })}
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
            {errorMessage(error.error)}
          </Text>
        ) : null}
        <Button
          label={t('learnerLearn.quiz.submit')}
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
          {result.passed
            ? t('learnerLearn.quiz.result.passed')
            : t('learnerLearn.quiz.result.notYet')}
        </Text>
        <Text variant="display" style={{ fontSize: 48, lineHeight: 52 }}>
          {t('learnerLearn.percent', { percent: result.grade.scorePercent })}
        </Text>
        <Text tone="secondary" align="center">
          {t('learnerLearn.quiz.result.summary', {
            correct: result.grade.correctCount,
            total: result.grade.totalQuestions,
            passMark: artefact.quiz.passMarkPercent,
          })}
        </Text>
        {!result.passed && result.attemptsRemaining > 0 ? (
          <Button
            label={t('learnerLearn.quiz.tryAgain', { count: result.attemptsRemaining })}
            variant="accent"
            onPress={begin}
            loading={busy}
          />
        ) : null}
        {!result.passed && result.attemptsRemaining === 0 ? (
          <Text tone="danger">{t('learnerLearn.quiz.noAttemptsLeft')}</Text>
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
                  {t('learnerLearn.numbered', { number: i + 1, title: q?.prompt ?? '' })}
                </Text>
              </View>
              <Text variant="small" tone={p.correct ? 'success' : 'danger'}>
                {chosen === undefined
                  ? t('learnerLearn.quiz.noAnswer')
                  : t('learnerLearn.quiz.yourAnswer', { answer: chosen })}
              </Text>
              {!p.correct ? (
                <Text variant="small" tone="secondary">
                  {t('learnerLearn.quiz.correctAnswer', { answer: correct ?? '' })}
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
