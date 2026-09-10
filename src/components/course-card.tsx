import { router } from 'expo-router'
import { Image, Pressable } from 'react-native'
import { Paragraph, XStack, YStack } from 'tamagui'
import { isEnrolled } from '../lib/catalog'
import type { Course } from '../types'
import { ColorDot, Eyebrow, Surface } from './chrome'

export function CourseCard({
  course,
  compact = false,
}: {
  course: Course
  compact?: boolean
}) {
  const enrolled = isEnrolled(course)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={course.name}
      onPress={() => router.push(`/course/${course.id}`)}
    >
      <YStack
        cursor="pointer"
        pressStyle={{ opacity: 0.88 }}
        width={compact ? '100%' : 220}
      >
        <Surface gap="$3" padding={0} overflow="hidden">
          {course.thumbnail ? (
            <Image
              source={{ uri: course.thumbnail }}
              style={{
                width: '100%',
                aspectRatio: compact ? 2.2 : 1.35,
                backgroundColor: '#f0f0f0',
              }}
              resizeMode="cover"
            />
          ) : null}
          <YStack gap="$2" padding="$3">
            <XStack justifyContent="space-between" alignItems="center" gap="$2">
              <XStack alignItems="center" gap="$2" flex={1}>
                <ColorDot color={course.color} />
                <Eyebrow>{course.code || 'Course'}</Eyebrow>
              </XStack>
              <Eyebrow>{enrolled ? 'Enrolled' : 'Catalog'}</Eyebrow>
            </XStack>
            <Paragraph color="$color12" fontSize={compact ? '$5' : '$6'} fontWeight="700">
              {course.name}
            </Paragraph>
            {course.instructor ? (
              <Paragraph color="$color10" fontSize="$3" numberOfLines={1}>
                {course.instructor}
              </Paragraph>
            ) : null}
          </YStack>
        </Surface>
      </YStack>
    </Pressable>
  )
}
