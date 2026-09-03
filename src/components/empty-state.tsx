import { Paragraph, YStack } from 'tamagui'
import { Eyebrow } from './chrome'

export function EmptyState({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <YStack
      alignItems="flex-start"
      justifyContent="center"
      padding="$4"
      gap="$2"
      backgroundColor="$color2"
      borderWidth={1}
      borderColor="$color4"
      borderRadius="$2"
    >
      <Eyebrow>{title}</Eyebrow>
      <Paragraph color="$color10">{body}</Paragraph>
    </YStack>
  )
}
