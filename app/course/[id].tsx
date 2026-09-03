import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Platform } from 'react-native'
import { Button, Input, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { AccentButton, Chip, Eyebrow, Surface } from '../../src/components/chrome'
import { ColorPicker } from '../../src/components/color-picker'
import { Field, TextField } from '../../src/components/field'
import { Screen } from '../../src/components/screen'
import { WEEKDAYS, formatTime, toISODate } from '../../src/lib/dates'
import { usePlanner } from '../../src/store/planner-store'
import type { CourseColor, Weekday } from '../../src/types'

export default function CourseDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const {
    ready,
    getCourse,
    updateCourse,
    deleteCourse,
    addMeeting,
    removeMeeting,
    tasks,
    addTask,
  } = usePlanner()
  const course = getCourse(id)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [instructor, setInstructor] = useState('')
  const [location, setLocation] = useState('')
  const [color, setColor] = useState<CourseColor>('teal')
  const [day, setDay] = useState<Weekday>(1)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:20')
  const [taskTitle, setTaskTitle] = useState('')

  useEffect(() => {
    if (!course) return
    setName(course.name)
    setCode(course.code)
    setInstructor(course.instructor)
    setLocation(course.location)
    setColor(course.color)
  }, [course])

  const courseTasks = useMemo(
    () => tasks.filter((task) => task.courseId === id),
    [id, tasks]
  )

  if (!ready) {
    return (
      <Screen justifyContent="center" alignItems="center">
        <Spinner />
      </Screen>
    )
  }

  if (!course) {
    return (
      <Screen>
        <Paragraph>That course was removed.</Paragraph>
      </Screen>
    )
  }

  const current = course

  function save() {
    if (!name.trim()) return
    updateCourse({
      ...current,
      name: name.trim(),
      code: code.trim(),
      instructor: instructor.trim(),
      location: location.trim(),
      color,
    })
  }

  function confirmDelete() {
    const remove = () => {
      deleteCourse(current.id)
      router.back()
    }
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${current.name}?`)) remove()
      return
    }
    Alert.alert('Delete course', `Remove ${current.name} and its tasks?`, [
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
                <YStack onPress={() => removeMeeting(current.id, meeting.id)} cursor="pointer">
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
          onPress={() => addMeeting(current.id, { day, start, end })}
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
                courseId: current.id,
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
