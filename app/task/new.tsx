import { router } from 'expo-router'
import { useState } from 'react'
import { Paragraph, XStack, YStack } from 'tamagui'
import { AccentButton, Chip } from '../../src/components/chrome'
import { Field, TextField } from '../../src/components/field'
import { Screen } from '../../src/components/screen'
import { toISODate } from '../../src/lib/dates'
import { usePlanner } from '../../src/store/planner-store'

export default function NewTaskScreen() {
  const { courses, addTask } = usePlanner()
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueAt, setDueAt] = useState(toISODate(new Date()))

  function save() {
    if (!title.trim() || !courseId) return
    addTask({
      courseId,
      title: title.trim(),
      notes: notes.trim(),
      dueAt,
    })
    router.back()
  }

  return (
    <Screen scroll>
      <YStack gap="$4" paddingVertical="$3">
        <Field label="Course">
          <XStack flexWrap="wrap" gap="$2">
            {courses.map((course) => (
              <Chip
                key={course.id}
                selected={course.id === courseId}
                onPress={() => setCourseId(course.id)}
              >
                <Paragraph color="$color12">{course.code || course.name}</Paragraph>
              </Chip>
            ))}
          </XStack>
        </Field>
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Problem set" />
        <TextField
          label="Due date"
          value={dueAt}
          onChangeText={setDueAt}
          placeholder="YYYY-MM-DD"
        />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional details"
          multiline
        />
        <AccentButton
          disabled={!title.trim() || !courseId}
          opacity={title.trim() && courseId ? 1 : 0.5}
          onPress={save}
        >
          Create task
        </AccentButton>
      </YStack>
    </Screen>
  )
}
