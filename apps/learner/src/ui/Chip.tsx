import { Pressable } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from './Text'

export type ChipProps = { label: string; selected?: boolean; onPress?: () => void }

export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, radii, space } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
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
