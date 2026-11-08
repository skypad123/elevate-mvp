import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Platform } from 'react-native'
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui'
import { AccentButton, Chip, Eyebrow, Surface } from '../../src/components/chrome'
import { ColorPicker } from '../../src/components/color-picker'
import { Field, TextField } from '../../src/components/field'
import { Screen } from '../../src/components/screen'
import { WEEKDAYS, formatTime, toISODate } from '../../src/lib/dates'
import { isEnrolled } from '../../src/lib/catalog'
import { useCourse, useCourseTasks } from '../../src/store/planner-selectors'
import { usePlannerStore } from '../../src/store/planner-store'
import type { Course, CourseColor, Weekday } from '../../src/types'

export default function CourseDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const course = useCourse(id)

  if (!course) {
    return (
      <Screen>
        <Paragraph>That course was removed.</Paragraph>
      </Screen>
    )
  }

  // Keyed by id so the editor's form state is seeded once per course and
  // survives store updates (adding a meeting, enrolling) without losing edits.
  return <CourseEditor key={course.id} course={course} />
}

function CourseEditor({ course }: { course: Course }) {
  const updateCourse = usePlannerStore((state) => state.updateCourse)
  const deleteCourse = usePlannerStore((state) => state.deleteCourse)
  const enrollCourse = usePlannerStore((state) => state.enrollCourse)
  const addMeeting = usePlannerStore((state) => state.addMeeting)
  const removeMeeting = usePlannerStore((state) => state.removeMeeting)
  const addTask = usePlannerStore((state) => state.addTask)
  const courseTasks = useCourseTasks(course.id)

  const [name, setName] = useState(course.name)
  const [code, setCode] = useState(course.code)
  const [instructor, setInstructor] = useState(course.instructor)
  const [location, setLocation] = useState(course.location)
  const [color, setColor] = useState<CourseColor>(course.color)
  const [day, setDay] = useState<Weekday>(1)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:20')
  const [taskTitle, setTaskTitle] = useState('')

  function save() {
    if (!name.trim()) return
    updateCourse({
      ...course,
      name: name.trim(),
      code: code.trim(),
      instructor: instructor.trim(),
      location: location.trim(),
      color,
    })
  }

  function confirmDelete() {
    const remove = () => {
      deleteCourse(course.id)
      router.back()
    }
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${course.name}?`)) remove()
      return
    }
    Alert.alert('Delete course', `Remove ${course.name} and its tasks?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ])
  }

  return (
    <Screen scroll>
      <YStack gap="$4" paddingVertical="$3">
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField label="Code" value={code} onChangeText={setCode} placeholder="CS 161" />
        <TextField label="Instructor" value={instructor} onChangeText={setInstructor} />
        <TextField label="Location" value={location} onChangeText={setLocation} />
        <Field label="Color">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <AccentButton onPress={save}>Save course</AccentButton>
        {!isEnrolled(course) ? (
          <AccentButton onPress={() => enrollCourse(course.id)}>Enroll in course</AccentButton>
        ) : null}

        <Eyebrow>Meetings</Eyebrow>
        {course.meetings.length === 0 ? (
          <Paragraph color="$color10">No weekly meetings yet.</Paragraph>
        ) : (
          course.meetings.map((meeting) => (
            <Surface key={meeting.id} padding="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <Paragraph color="$color12">
                  {WEEKDAYS[meeting.day]} {formatTime(meeting.start)}–
                  {formatTime(meeting.end)}
                </Paragraph>
                <YStack onPress={() => removeMeeting(course.id, meeting.id)} cursor="pointer">
                  <Paragraph color="$red10">Remove</Paragraph>
                </YStack>
              </XStack>
            </Surface>
          ))
        )}

        <XStack gap="$2" flexWrap="wrap">
          {WEEKDAYS.map((label, index) => (
            <Chip
              key={label}
              selected={day === index}
              onPress={() => setDay(index as Weekday)}
            >
              <Paragraph color="$color12">{label}</Paragraph>
            </Chip>
          ))}
        </XStack>
        <XStack gap="$3">
          <YStack flex={1}>
            <TextField label="Start" value={start} onChangeText={setStart} placeholder="09:00" />
          </YStack>
          <YStack flex={1}>
            <TextField label="End" value={end} onChangeText={setEnd} placeholder="10:20" />
          </YStack>
        </XStack>
        <Button
          variant="outlined"
          borderRadius="$2"
          onPress={() => addMeeting(course.id, { day, start, end })}
        >
          Add meeting
        </Button>

        <Eyebrow>Tasks</Eyebrow>
        {courseTasks.map((task) => (
          <Paragraph
            key={task.id}
            color={task.done ? '$color9' : '$color12'}
            textDecorationLine={task.done ? 'line-through' : 'none'}
          >
            {task.title}
          </Paragraph>
        ))}
        <XStack gap="$2" alignItems="flex-end">
          <YStack flex={1}>
            <Field label="New task">
              <Input
                value={taskTitle}
                onChangeText={setTaskTitle}
                placeholder="Assignment title"
                backgroundColor="$color2"
                borderColor="$color4"
                borderWidth={1}
                borderRadius="$2"
                color="$color12"
              />
            </Field>
          </YStack>
          <AccentButton
            onPress={() => {
              if (!taskTitle.trim()) return
              addTask({
                courseId: course.id,
                title: taskTitle.trim(),
                notes: '',
                dueAt: toISODate(new Date()),
              })
              setTaskTitle('')
            }}
          >
            Add
          </AccentButton>
        </XStack>

        <Button theme="error" borderRadius="$2" onPress={confirmDelete}>
          Delete course
        </Button>
      </YStack>
    </Screen>
  )
}
