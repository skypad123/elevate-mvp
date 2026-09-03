import Ionicons from '@expo/vector-icons/Ionicons'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Image } from 'react-native'
import { Input, Paragraph, XStack, YStack } from 'tamagui'
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
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCourses = courses.filter((course) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      course.name.toLowerCase().includes(query) ||
      course.code.toLowerCase().includes(query) ||
      course.instructor.toLowerCase().includes(query)
    )
  })

  return (
    <Screen scroll>
      <ScreenHeader
        eyebrow="Elvate"
        title="Courses"
        action={<AccentButton onPress={() => router.push('/course/new')}>Add</AccentButton>}
      />

      <YStack gap="$4" marginBottom="$4">
        <XStack
          alignItems="center"
          backgroundColor="$color2"
          borderWidth={1}
          borderColor="$color4"
          borderRadius="$2"
          paddingHorizontal="$3"
          paddingVertical="$2"
          gap="$2"
        >
          <Ionicons name="search" size={20} color="gray" />
          <Input
            flex={1}
            placeholder="Search courses..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            backgroundColor="transparent"
            borderWidth={0}
            padding={0}
            fontSize="$4"
            placeholderTextColor="$color9"
          />
        </XStack>
      </YStack>

      {filteredCourses.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No courses found' : 'No courses yet'}
          body={
            searchQuery
              ? 'Try a different search term.'
              : 'Add a class to start planning meetings and assignments.'
          }
        />
      ) : (
        <XStack flexWrap="wrap" gap="$3">
          {filteredCourses.map((course) => {
            const openTasks = tasks.filter(
              (task) => task.courseId === course.id && !task.done
            ).length
            return (
              <Link key={course.id} href={`/course/${course.id}`} asChild>
                <YStack
                  cursor="pointer"
                  pressStyle={{ opacity: 0.88 }}
                  width="calc(50% - 12px)"
                  minWidth={280}
                >
                  <Surface gap="$3" padding={0} overflow="hidden">
                    {course.thumbnail ? (
                      <Image
                        source={{ uri: course.thumbnail }}
                        style={{
                          width: '100%',
                          aspectRatio: 1,
                          backgroundColor: '#f0f0f0',
                        }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <YStack gap="$3" padding="$4">
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
                    </YStack>
                  </Surface>
                </YStack>
              </Link>
            )
          })}
        </XStack>
      )}
    </Screen>
  )
}
