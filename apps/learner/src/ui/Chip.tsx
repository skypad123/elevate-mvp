import { Platform, Pressable } from 'react-native'
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
  testID?: string
  /** The label's language, when it differs from the page's (a language's own name). Web only. */
  lang?: string
}

export function Chip({ label, selected, onPress, role = 'button', testID, lang }: ChipProps) {
  const { colors, radii, space } = useTheme()
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { checked: !!selected } : { selected: !!selected }}
      // React Native Web does not turn accessibilityState into aria-checked.
      aria-checked={role === 'radio' ? !!selected : undefined}
      testID={testID}
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
      <Text
        variant="smallStrong"
        tone={selected ? 'brand' : 'secondary'}
        // React Native's strict types have no `lang`, but React Native Web renders it.
        {...(Platform.OS === 'web' && lang ? ({ lang } as object) : {})}
      >
        {label}
      </Text>
    </Pressable>
  )
}
