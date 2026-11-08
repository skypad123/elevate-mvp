import type { PropsWithChildren } from 'react'
import { ScrollView, type ScrollViewProps, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/theme/ThemeProvider'

export type ScreenProps = PropsWithChildren<{
  scroll?: boolean
  maxWidth?: number
  padded?: boolean
  bottomInset?: number
  contentContainerStyle?: ScrollViewProps['contentContainerStyle']
}>

/** Page container: safe areas, horizontal gutters, centred max width. */
export function Screen({
  children,
  scroll = true,
  maxWidth,
  padded = true,
  bottomInset = 0,
  contentContainerStyle,
}: ScreenProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const gutter = width >= theme.breakpoints.md ? theme.space[8] : theme.space[4]
  const inner = {
    width: '100%' as const,
    maxWidth: maxWidth ?? theme.layout.contentMaxWidth,
    alignSelf: 'center' as const,
    paddingHorizontal: padded ? gutter : 0,
  }
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      </View>
    )
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={[
        {
          paddingTop: insets.top + theme.space[4],
          paddingBottom: insets.bottom + bottomInset + theme.space[8],
        },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={inner}>{children}</View>
    </ScrollView>
  )
}
