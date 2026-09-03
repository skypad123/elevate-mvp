import { useMemo, useState } from 'react'
import { Paragraph, Theme, XStack, YStack } from 'tamagui'
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

export default function WeekScreen() {
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
    <Screen scroll>
      <ScreenHeader eyebrow="Schedule" title="This week" />

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
  )
}
