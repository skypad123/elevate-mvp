import { ChevronUp } from 'lucide-react-native'
import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from './Text'

export function Logo({ size = 'md', suffix }: { size?: 'sm' | 'md' | 'lg'; suffix?: string }) {
  const { colors, radii } = useTheme()
  const dim = size === 'lg' ? 40 : size === 'sm' ? 24 : 30
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: dim,
          height: dim,
          borderRadius: radii.sm,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronUp size={dim * 0.65} color={colors.brandInk} strokeWidth={3} />
      </View>
      <Text
        variant={size === 'lg' ? 'h1' : size === 'sm' ? 'h3' : 'h2'}
        style={{ letterSpacing: -0.5 }}
      >
        Elevate
      </Text>
      {suffix ? (
        <Text variant={size === 'lg' ? 'h3' : 'bodyStrong'} tone="secondary">
          {suffix}
        </Text>
      ) : null}
    </View>
  )
}
