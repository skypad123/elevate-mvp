import { Pressable } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from './Text'

export type ChipProps = {
  label: string
  selected?: boolean
  onPress?: () => void
  /**
   * `radio` for one choice out of a group (put the chips in a `radiogroup` with a label), so a
   * screen reader says "selected, 1 of 3". `button` (the default) for a chip that acts on its own.
   */
  role?: 'button' | 'radio'
}

export function Chip({ label, selected, onPress, role = 'button' }: ChipProps) {
  const { colors, radii, space } = useTheme()
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { checked: !!selected } : { selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: space[3],
        height: 34,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
        backgroundColor: selected ? colors.brandTint : colors.surface,
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text variant="smallStrong" tone={selected ? 'brand' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  )
}
