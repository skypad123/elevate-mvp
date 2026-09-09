import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Modal } from 'react-native'
import { Button, Paragraph, Progress, Theme, XStack, YStack } from 'tamagui'
import {
  ColorDot,
  Eyebrow,
  ScreenHeader,
  Surface,
} from '../../src/components/chrome'
import { EmptyState } from '../../src/components/empty-state'
import { Screen } from '../../src/components/screen'
import {
  WEEKDAYS,
  formatTime,
  isSameDay,
  toISODate,
  weekDays,
  weekdayOf,
} from '../../src/lib/dates'
import { usePlanner } from '../../src/store/planner-store'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from 'tamagui'

function WeekScheduleModal({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const { courses } = usePlanner()
  const days = useMemo(() => weekDays(new Date()), [])
  const [selected, setSelected] = useState(() => toISODate(new Date()))
  const selectedDate = days.find((day) => toISODate(day) === selected) ?? new Date()
  const weekday = weekdayOf(selectedDate)

  const meetings = courses
    .flatMap((course) =>
      course.meetings
        .filter((meeting) => meeting.day === weekday)
        .map((meeting) => ({ course, meeting }))
    )
    .sort((a, b) => a.meeting.start.localeCompare(b.meeting.start))

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen scroll>
        <ScreenHeader
          eyebrow="Schedule"
          title="This week"
          action={
            <Button size="$3" chromeless onPress={onClose}>
              <Ionicons name="close" size={24} />
            </Button>
          }
        />

        <XStack gap="$2" marginBottom="$4">
          {days.map((day) => {
            const iso = toISODate(day)
            const active = iso === selected
            const today = isSameDay(day, new Date())
            const cell = (
              <YStack
                width="100%"
                onPress={() => setSelected(iso)}
                backgroundColor={active ? '$background' : '$color2'}
                borderWidth={1}
                borderColor={active ? '$background' : '$color4'}
                borderRadius="$2"
                paddingVertical="$3"
                alignItems="center"
                gap="$1"
                cursor="pointer"
              >
                <Eyebrow>{WEEKDAYS[day.getDay()]}</Eyebrow>
                <Paragraph
                  color={active ? '$color12' : today ? '$accent10' : '$color12'}
                  fontWeight="700"
                >
                  {day.getDate()}
                </Paragraph>
              </YStack>
            )

            return (
              <YStack key={iso} flex={1}>
                {active ? <Theme name="accent">{cell}</Theme> : cell}
              </YStack>
            )
          })}
        </XStack>

        {meetings.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            body="Add meeting times on a course to see them on the week view."
          />
        ) : (
          <YStack gap="$3">
            {meetings.map(({ course, meeting }, index) => (
              <Surface key={meeting.id} accent={index === 0} gap="$2">
                <Eyebrow>
                  {`${formatTime(meeting.start)} – ${formatTime(meeting.end)}`}
                </Eyebrow>
                <XStack alignItems="center" gap="$2">
                  <ColorDot color={course.color} />
                  <Paragraph color="$color12" fontSize="$6" fontWeight="700">
                    {course.name}
                  </Paragraph>
                </XStack>
                <Paragraph color="$color10">
                  {[course.code, course.location].filter(Boolean).join('  ·  ')}
                </Paragraph>
              </Surface>
            ))}
          </YStack>
        )}
      </Screen>
    </Modal>
  )
}

export default function EnrollmentsScreen() {
  const { courses, tasks } = usePlanner()
  const [showWeekSchedule, setShowWeekSchedule] = useState(false)
  const theme = useTheme()

  const courseProgress = useMemo(() => {
    return courses.map((course) => {
      const courseTasks = tasks.filter((task) => task.courseId === course.id)
      const completedTasks = courseTasks.filter((task) => task.done).length
      const totalTasks = courseTasks.length
      const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      return {
        course,
        completedTasks,
        totalTasks,
        progress,
      }
    })
  }, [courses, tasks])

  return (
    <>
      <Screen scroll>
        <ScreenHeader
          eyebrow="Elevate"
          title="Enrollments"
          action={
            <Button
              size="$3"
              chromeless
              icon={<Ionicons name="calendar-outline" size={24} color={theme.accent10?.val} />}
              onPress={() => setShowWeekSchedule(true)}
            />
          }
        />

        {courses.length === 0 ? (
          <EmptyState
            title="No enrollments yet"
            body="Add a course to start tracking your progress."
          />
        ) : (
          <YStack gap="$3">
            {courseProgress.map(({ course, completedTasks, totalTasks, progress }) => (
              <YStack
                key={course.id}
                cursor="pointer"
                pressStyle={{ opacity: 0.88 }}
                onPress={() => router.push(`/course/${course.id}`)}
              >
                <Surface gap="$3">
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <YStack flex={1} gap="$2">
                      <XStack alignItems="center" gap="$2">
                        <ColorDot color={course.color} />
                        <Eyebrow>{course.code || 'Course'}</Eyebrow>
                      </XStack>
                      <Paragraph color="$color12" fontSize="$7" fontWeight="700">
                        {course.name}
                      </Paragraph>
                      {course.instructor ? (
                        <Paragraph color="$color10">{course.instructor}</Paragraph>
                      ) : null}
                    </YStack>
                  </XStack>

                  {totalTasks > 0 && (
                    <YStack gap="$2">
                      <XStack justifyContent="space-between" alignItems="center">
                        <Eyebrow>
                          {`${completedTasks} of ${totalTasks} task${totalTasks === 1 ? '' : 's'} completed`}
                        </Eyebrow>
                        <Paragraph color="$color10" fontSize="$4" fontWeight="600">
                          {Math.round(progress)}%
                        </Paragraph>
                      </XStack>
                      <Progress value={progress} max={100}>
                        <Progress.Indicator backgroundColor="$accent10" />
                      </Progress>
                    </YStack>
                  )}

                  {totalTasks === 0 && (
                    <Eyebrow>No tasks yet</Eyebrow>
                  )}
                </Surface>
              </YStack>
            ))}
          </YStack>
        )}
      </Screen>

      <WeekScheduleModal
        visible={showWeekSchedule}
        onClose={() => setShowWeekSchedule(false)}
      />
    </>
  )
}
