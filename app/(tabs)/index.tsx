import { Link, router } from 'expo-router'
import { Paragraph, XStack, YStack } from 'tamagui'
import {
  AccentButton,
  ColorDot,
  Eyebrow,
  ScreenHeader,
  Surface,
} from '../../src/components/chrome'
import { EmptyState } from '../../src/components/empty-state'
import { Screen } from '../../src/components/screen'
import { WEEKDAYS, formatTime } from '../../src/lib/dates'
import { usePlanner } from '../../src/store/planner-store'

export default function CoursesScreen() {
  const { courses, tasks } = usePlanner()

  return (
    <Screen scroll>
      <ScreenHeader
        eyebrow="Elvate"
        title="Courses"
        action={
          <XStack gap="$2">
            <AccentButton onPress={() => router.push('/login')}>Login</AccentButton>
            <AccentButton onPress={() => router.push('/course/new')}>Add</AccentButton>
          </XStack>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          body="Add a class to start planning meetings and assignments."
        />
      ) : (
        <YStack gap="$3">
          {courses.map((course) => {
            const openTasks = tasks.filter(
              (task) => task.courseId === course.id && !task.done
            ).length
            return (
              <Link key={course.id} href={`/course/${course.id}`} asChild>
                <YStack cursor="pointer" pressStyle={{ opacity: 0.88 }}>
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
                      <Paragraph color="$color8">›</Paragraph>
                    </XStack>
                    <Paragraph color="$color10">
                      {course.meetings.length
                        ? course.meetings
                            .map(
                              (meeting) =>
                                `${WEEKDAYS[meeting.day]} ${formatTime(meeting.start)}`
                            )
                            .join('  ·  ')
                        : 'No meetings'}
                    </Paragraph>
                    <Eyebrow>
                      {`${openTasks} open task${openTasks === 1 ? '' : 's'}`}
                    </Eyebrow>
                  </Surface>
                </YStack>
              </Link>
            )
          })}
        </YStack>
      )}
    </Screen>
  )
}
