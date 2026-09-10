import { Href, router } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView } from 'react-native'
import { Paragraph, XStack, YStack } from 'tamagui'
import { Eyebrow, ScreenHeader } from '../../src/components/chrome'
import { CourseCard } from '../../src/components/course-card'
import { EmptyState } from '../../src/components/empty-state'
import { Screen } from '../../src/components/screen'
import { HomeSearchBar } from '../../src/components/search-bar'
import { getRecommendedCourses, getTrendingCourses } from '../../src/lib/catalog'
import { usePlanner } from '../../src/store/planner-store'
import { useProfile } from '../../src/store/profile-store'
import type { Course } from '../../src/types'

function CourseRail({
  eyebrow,
  title,
  courses,
}: {
  eyebrow: string
  title: string
  courses: Course[]
}) {
  if (courses.length === 0) {
    return (
      <YStack gap="$3" paddingHorizontal="$4">
        <YStack gap="$1">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Paragraph color="$color12" fontSize="$7" fontWeight="700">
            {title}
          </Paragraph>
        </YStack>
        <EmptyState
          title="Nothing here yet"
          body="Add a class so Elevate can recommend courses from the catalog."
        />
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      <YStack gap="$1" paddingHorizontal="$4">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Paragraph color="$color12" fontSize="$7" fontWeight="700">
          {title}
        </Paragraph>
      </YStack>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$3" paddingHorizontal="$4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </XStack>
      </ScrollView>
    </YStack>
  )
}

export default function HomeScreen() {
  const { courses } = usePlanner()
  const { profile } = useProfile()
  const firstName = profile.name.trim().split(/\s+/)[0] || 'Student'

  const recommended = useMemo(() => getRecommendedCourses(courses), [courses])
  const trending = useMemo(() => getTrendingCourses(courses), [courses])

  return (
    <Screen
      scroll
      fullWidth
      scrollProps={{ contentContainerStyle: { paddingBottom: 128 } }}
    >
      <YStack gap="$5" paddingBottom="$4">
        <YStack paddingHorizontal="$4">
          <ScreenHeader eyebrow="elevate" title={`Hi, ${firstName}`} />
        </YStack>

        <YStack paddingHorizontal="$4">
          <HomeSearchBar onPress={() => router.push('/search' as Href)} />
        </YStack>

        <CourseRail eyebrow="For you" title="Recommendations" courses={recommended} />
        <CourseRail eyebrow="Trending" title="What's hot" courses={trending} />
      </YStack>
    </Screen>
  )
}
