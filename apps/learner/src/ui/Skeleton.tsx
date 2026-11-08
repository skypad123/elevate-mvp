import { useEffect, useRef } from 'react'
import { Animated, type DimensionValue } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'

export function Skeleton({
  width = '100%',
  height = 16,
  radius,
}: {
  width?: DimensionValue
  height?: number
  radius?: number
}) {
  const { colors, radii } = useTheme()
  const opacity = useRef(new Animated.Value(0.6)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius ?? radii.sm,
        backgroundColor: colors.surfaceSunken,
        opacity,
      }}
    />
  )
}
