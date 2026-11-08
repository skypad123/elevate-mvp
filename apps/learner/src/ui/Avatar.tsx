import { Image } from 'expo-image'
import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from './Text'

export function initialsOf(name: string | null | undefined, fallback = '?'): string {
  if (!name) return fallback
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || fallback
}

export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string | null | undefined
  url?: string | null
  size?: number
}) {
  const { colors, radii } = useTheme()
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radii.pill }}
        contentFit="cover"
      />
    )
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        backgroundColor: colors.brandTint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant={size >= 56 ? 'h3' : 'smallStrong'} tone="brand">
        {initialsOf(name)}
      </Text>
    </View>
  )
}
