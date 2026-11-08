import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'

export function ProgressBar({
  percent,
  height = 6,
  tone = 'brand',
}: {
  percent: number
  height?: number
  tone?: 'brand' | 'accent'
}) {
  const { colors, radii } = useTheme()
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{
        height,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height,
          backgroundColor: tone === 'accent' ? colors.accent : colors.brand,
          borderRadius: radii.pill,
        }}
      />
    </View>
  )
}
