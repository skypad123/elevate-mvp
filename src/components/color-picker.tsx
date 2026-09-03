import { Theme, XStack, YStack } from 'tamagui'
import { COURSE_COLORS, type CourseColor } from '../types'

export function ColorPicker({
  value,
  onChange,
}: {
  value: CourseColor
  onChange: (color: CourseColor) => void
}) {
  return (
    <XStack flexWrap="wrap" gap="$2">
      {COURSE_COLORS.map((color) => {
        const selected = color === value
        return (
          <Theme key={color} name={color}>
            <YStack
              onPress={() => onChange(color)}
              width={28}
              height={28}
              borderRadius={4}
              backgroundColor="$color9"
              borderWidth={selected ? 2 : 0}
              borderColor="$color12"
              cursor="pointer"
            />
          </Theme>
        )
      })}
    </XStack>
  )
}
