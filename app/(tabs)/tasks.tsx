import { router } from 'expo-router'
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
import { dueLabel, formatDate } from '../../src/lib/dates'
import { usePlanner } from '../../src/store/planner-store'

export default function TasksScreen() {
  const { tasks, courses, toggleTask } = usePlanner()
  const open = tasks
    .filter((task) => !task.done)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const done = tasks.filter((task) => task.done)

  return (
    <Screen scroll>
      <ScreenHeader
        eyebrow="Work"
        title="Tasks"
        action={
          <AccentButton
            disabled={courses.length === 0}
            opacity={courses.length === 0 ? 0.5 : 1}
            onPress={() => router.push('/task/new')}
          >
            Add
          </AccentButton>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          body="Track problem sets, readings, and labs against each course."
        />
      ) : (
        <YStack gap="$4">
          <YStack gap="$2">
            <Eyebrow>Open</Eyebrow>
            {open.length === 0 ? (
              <EmptyState title="Caught up" body="No open tasks right now." />
            ) : (
              open.map((task) => {
                const course = courses.find((item) => item.id === task.courseId)
                return (
                  <Surface key={task.id} padding="$3">
                    <XStack gap="$3" alignItems="center">
                      <YStack
                        onPress={() => toggleTask(task.id)}
                        width={18}
                        height={18}
                        borderRadius={3}
                        borderWidth={1}
                        borderColor="$color8"
                        backgroundColor="transparent"
                        cursor="pointer"
                      />
                      <YStack flex={1} gap="$1">
                        <Paragraph color="$color12" fontWeight="700">
                          {task.title}
                        </Paragraph>
                        <XStack alignItems="center" gap="$2">
                          {course ? <ColorDot color={course.color} /> : null}
                          <Paragraph color="$color10">
                            {course?.name ?? 'Course'} · {formatDate(task.dueAt)}
                          </Paragraph>
                        </XStack>
                      </YStack>
                      <Eyebrow>{dueLabel(task.dueAt)}</Eyebrow>
                    </XStack>
                  </Surface>
                )
              })
            )}
          </YStack>

          {done.length > 0 ? (
            <YStack gap="$2">
              <Eyebrow>Done</Eyebrow>
              {done.map((task) => (
                <YStack key={task.id} onPress={() => toggleTask(task.id)} cursor="pointer">
                  <Paragraph color="$color9" textDecorationLine="line-through">
                    {task.title}
                  </Paragraph>
                </YStack>
              ))}
            </YStack>
          ) : null}
        </YStack>
      )}
    </Screen>
  )
}
