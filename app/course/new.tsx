import { router } from 'expo-router'
import { useState } from 'react'
import { YStack } from 'tamagui'
import { AccentButton } from '../../src/components/chrome'
import { ColorPicker } from '../../src/components/color-picker'
import { Field, TextField } from '../../src/components/field'
import { Screen } from '../../src/components/screen'
import { usePlanner } from '../../src/store/planner-store'
import type { CourseColor } from '../../src/types'

export default function NewCourseScreen() {
  const { addCourse } = usePlanner()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [instructor, setInstructor] = useState('')
  const [location, setLocation] = useState('')
  const [color, setColor] = useState<CourseColor>('teal')

  function save() {
    if (!name.trim()) return
    const id = addCourse({
      name: name.trim(),
      code: code.trim(),
      instructor: instructor.trim(),
      location: location.trim(),
      color,
    })
    router.replace(`/course/${id}`)
  }

  return (
    <Screen scroll>
      <YStack gap="$4" paddingVertical="$3">
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Course name" />
        <TextField label="Code" value={code} onChangeText={setCode} placeholder="CS 161" />
        <TextField
          label="Instructor"
          value={instructor}
          onChangeText={setInstructor}
          placeholder="Instructor"
        />
        <TextField
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="Building and room"
        />
        <Field label="Color">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <AccentButton
          disabled={!name.trim()}
          opacity={name.trim() ? 1 : 0.5}
          onPress={save}
        >
          Create course
        </AccentButton>
      </YStack>
    </Screen>
  )
}
