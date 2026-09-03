import type { ComponentProps, ReactNode } from 'react'
import { Button, H2, Paragraph, Theme, XStack, YStack, type YStackProps } from 'tamagui'
import type { CourseColor } from '../types'

export function Eyebrow({ children }: { children: string }) {
  return (
    <Paragraph
      fontFamily="$mono"
      fontSize={11}
      letterSpacing={2.6}
      textTransform="uppercase"
      color="$color10"
    >
      {children}
    </Paragraph>
  )
}

export function ScreenHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: ReactNode
}) {
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      marginBottom="$5"
      gap="$3"
    >
      <YStack gap={6} flex={1}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <H2 color="$color12" letterSpacing={-0.4}>
          {title}
        </H2>
      </YStack>
      {action}
    </XStack>
  )
}

export function Surface({
  accent,
  children,
  ...props
}: YStackProps & { accent?: boolean }) {
  const card = (
    <YStack
      backgroundColor={accent ? '$background' : '$color2'}
      borderWidth={1}
      borderColor={accent ? '$background' : '$color4'}
      borderRadius="$2"
      padding="$4"
      {...props}
    >
      {children}
    </YStack>
  )

  return accent ? <Theme name="accent">{card}</Theme> : card
}

export function ColorDot({ color }: { color: CourseColor }) {
  return (
    <Theme name={color}>
      <YStack width={8} height={8} borderRadius={2} backgroundColor="$color9" />
    </Theme>
  )
}

export function AccentButton({
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button theme="accent" borderRadius="$2" size="$3" {...props}>
      {children}
    </Button>
  )
}

export function Chip({
  selected,
  children,
  onPress,
}: {
  selected?: boolean
  children: ReactNode
  onPress?: () => void
}) {
  const chip = (
    <YStack
      onPress={onPress}
      backgroundColor={selected ? '$background' : '$color2'}
      borderWidth={1}
      borderColor={selected ? '$background' : '$color4'}
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$2"
      cursor="pointer"
    >
      {children}
    </YStack>
  )

  return selected ? <Theme name="accent">{chip}</Theme> : chip
}
