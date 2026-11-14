import { type CourseCard as CourseCardData, categoryLabel, formatSgd } from '@elevate/core'
import { typeScale } from '@elevate/tokens'
import { Image } from 'expo-image'
import { Link } from 'expo-router'
import { Users } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Badge } from '@/ui/Badge'
import { Card } from '@/ui/Card'
import { Text } from '@/ui/Text'

export function CourseCard({ course }: { course: CourseCardData }) {
  const theme = useTheme()
  return (
    <Link href={`/course/${course.slug}`} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        <Card padded={false}>
          <View style={{ aspectRatio: 4 / 3, backgroundColor: theme.colors.surfaceSunken }}>
            {course.thumbnailUrl ? (
              <Image
                source={{ uri: course.thumbnailUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
              />
            ) : null}
          </View>
          <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
            <Badge label={categoryLabel(course.category)} tone="brand" />
            {/* Always two lines tall, so a short title doesn't make a shorter card. */}
            <Text variant="h3" numberOfLines={2} style={{ minHeight: 2 * typeScale.h3.lineHeight }}>
              {course.title}
            </Text>
            <Text variant="small" tone="secondary" numberOfLines={1}>
              {course.teacherName}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: theme.space[1],
              }}
            >
              <Text variant="price">{formatSgd(course.priceCents, { showFree: true })}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Users size={14} color={theme.colors.inkTertiary} />
                <Text variant="caption" tone="tertiary">
                  {course.enrolCount} · {course.lessonCount} lesson
                  {course.lessonCount === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  )
}
