import { type QuizDefinition, type QuizDefinitionInput, quizDefinitionSchema } from '@elevate/core'
import { Badge, Button, Card, Input, Textarea } from '@elevate/web-ui'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const blankQuestion = (): QuizDefinitionInput['questions'][number] => ({
  id: newId(),
  prompt: '',
  options: [
    { id: newId(), text: '', correct: true },
    { id: newId(), text: '', correct: false },
  ],
})

export function QuizEditor({
  value,
  onSave,
  disabled,
  saving,
}: {
  value: QuizDefinition | null
  onSave: (quiz: QuizDefinition) => Promise<unknown>
  disabled?: boolean
  saving?: boolean
}) {
  const [quiz, setQuiz] = useState<QuizDefinitionInput>(() => ({
    passMarkPercent: value?.passMarkPercent ?? 70,
    maxAttempts: value?.maxAttempts ?? 1,
    timeLimitMinutes: value?.timeLimitMinutes ?? null,
    questions: value?.questions.length ? value.questions : [blankQuestion()],
  }))
  const [dirty, setDirty] = useState(false)
  const [issues, setIssues] = useState<string[]>([])

  const update = (patch: Partial<QuizDefinitionInput>) => {
    setQuiz((q) => ({ ...q, ...patch }))
    setDirty(true)
  }
  const updateQuestion = (
    index: number,
    patch: Partial<QuizDefinitionInput['questions'][number]>,
  ) => update({ questions: quiz.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) })

  const save = async () => {
    const parsed = quizDefinitionSchema.safeParse(quiz)
    if (!parsed.success) {
      setIssues([
        ...new Set(
          parsed.error.issues.map((i) => `${describePath(i.path.map(String), quiz)}: ${i.message}`),
        ),
      ])
      return
    }
    setIssues([])
    await onSave(parsed.data)
    setDirty(false)
  }

  return (
    <div className="space-y-5">
      <Card className="grid gap-4 sm:grid-cols-3" muted>
        <Input
          label="Pass mark (%)"
          type="number"
          min={1}
          max={100}
          value={quiz.passMarkPercent}
          onChange={(e) => update({ passMarkPercent: Number(e.target.value) })}
          disabled={disabled}
        />
        <Input
          label="Attempts allowed"
          type="number"
          min={1}
          max={10}
          value={quiz.maxAttempts ?? 1}
          onChange={(e) => update({ maxAttempts: Number(e.target.value) })}
          disabled={disabled}
          hint="1 = single attempt"
        />
        <Input
          label="Time limit (minutes)"
          type="number"
          min={1}
          max={180}
          value={quiz.timeLimitMinutes ?? ''}
          placeholder="None"
          onChange={(e) =>
            update({ timeLimitMinutes: e.target.value ? Number(e.target.value) : null })
          }
          disabled={disabled}
        />
      </Card>

      <ol className="space-y-4">
        {quiz.questions.map((question, qi) => (
          <li key={question.id}>
            <Card className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge tone="brand" className="mt-2">
                  Q{qi + 1}
                </Badge>
                <Textarea
                  wrapperClassName="flex-1"
                  rows={2}
                  placeholder="Question"
                  value={question.prompt}
                  onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                  disabled={disabled}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove question"
                  disabled={disabled || quiz.questions.length === 1}
                  onClick={() => update({ questions: quiz.questions.filter((_, i) => i !== qi) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="space-y-2 pl-1">
                <p className="text-caption text-ink-tertiary">Options · select the correct one</p>
                {question.options.map((option, oi) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      aria-label={`Option ${oi + 1} is correct`}
                      checked={option.correct}
                      disabled={disabled}
                      onChange={() =>
                        updateQuestion(qi, {
                          options: question.options.map((o, i) => ({ ...o, correct: i === oi })),
                        })
                      }
                      className="size-4 accent-[var(--brand)]"
                    />
                    <Input
                      wrapperClassName="flex-1"
                      placeholder={`Option ${oi + 1}`}
                      value={option.text}
                      onChange={(e) =>
                        updateQuestion(qi, {
                          options: question.options.map((o, i) =>
                            i === oi ? { ...o, text: e.target.value } : o,
                          ),
                        })
                      }
                      disabled={disabled}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove option"
                      disabled={disabled || question.options.length <= 2}
                      onClick={() => {
                        const options = question.options.filter((_, i) => i !== oi)
                        if (!options.some((o) => o.correct) && options[0])
                          options[0] = { ...options[0], correct: true }
                        updateQuestion(qi, { options })
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  disabled={disabled || question.options.length >= 8}
                  onClick={() =>
                    updateQuestion(qi, {
                      options: [...question.options, { id: newId(), text: '', correct: false }],
                    })
                  }
                >
                  Add option
                </Button>
              </div>
              <Textarea
                rows={2}
                label="Explanation (shown after submitting, optional)"
                value={question.explanation ?? ''}
                onChange={(e) => updateQuestion(qi, { explanation: e.target.value || undefined })}
                disabled={disabled}
              />
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          icon={Plus}
          disabled={disabled || quiz.questions.length >= 50}
          onClick={() => update({ questions: [...quiz.questions, blankQuestion()] })}
        >
          Add question
        </Button>
        <div className="flex items-center gap-3">
          {dirty ? (
            <span className="text-small text-warning">Unsaved changes</span>
          ) : value?.questions.length ? (
            <span className="text-small text-success">Saved</span>
          ) : null}
          <Button onClick={save} loading={saving} disabled={disabled || !dirty}>
            Save quiz
          </Button>
        </div>
      </div>
      {issues.length ? (
        <ul className="list-disc space-y-1 rounded-card border border-danger bg-danger-tint p-4 pl-8 text-small text-danger">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function describePath(path: string[], quiz: QuizDefinitionInput): string {
  if (path[0] === 'questions' && path[1] !== undefined) {
    const qi = Number(path[1])
    const q = quiz.questions[qi]
    const label = `Q${qi + 1}${q?.prompt ? ` "${q.prompt.slice(0, 30)}"` : ''}`
    if (path[2] === 'options') return `${label} options`
    if (path[2]) return `${label} ${path[2]}`
    return label
  }
  return path.join('.') || 'Quiz'
}
