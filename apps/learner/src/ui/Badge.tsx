import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from './Text'

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const { colors, radii } = useTheme()
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceMuted, fg: colors.inkSecondary },
    brand: { bg: colors.brandTint, fg: colors.brand },
    accent: { bg: colors.accentTint, fg: colors.accent },
    success: { bg: colors.successTint, fg: colors.success },
    warning: { bg: colors.warningTint, fg: colors.warning },
    danger: { bg: colors.dangerTint, fg: colors.danger },
    info: { bg: colors.infoTint, fg: colors.info },
  }
  const c = map[tone]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: c.bg,
        borderRadius: radii.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text variant="caption" style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  )
}
