import { View, type ViewProps } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'

export type CardProps = ViewProps & { padded?: boolean; elevated?: boolean; muted?: boolean }

export function Card({ padded = true, elevated, muted, style, ...rest }: CardProps) {
  const theme = useTheme()
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: muted ? theme.colors.surfaceMuted : theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radii.card,
          padding: padded ? theme.space[5] : 0,
          overflow: 'hidden',
        },
        elevated ? theme.shadow : null,
        style,
      ]}
    />
  )
}
