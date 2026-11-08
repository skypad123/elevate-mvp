import type { TypeScaleKey } from '@elevate/tokens'
import { Text as RNText, type TextProps as RNTextProps } from 'react-native'
import type { Theme } from '@/theme'
import { useTheme } from '@/theme/ThemeProvider'

export type TextTone =
  | 'ink'
  | 'secondary'
  | 'tertiary'
  | 'brand'
  | 'accent'
  | 'inverse'
  | 'danger'
  | 'success'
  | 'warning'

export type TextProps = RNTextProps & {
  variant?: TypeScaleKey
  tone?: TextTone
  align?: 'left' | 'center' | 'right'
}

export function toneColor(theme: Theme, tone: TextTone): string {
  switch (tone) {
    case 'secondary':
      return theme.colors.inkSecondary
    case 'tertiary':
      return theme.colors.inkTertiary
    case 'brand':
      return theme.colors.brand
    case 'accent':
      return theme.colors.accent
    case 'inverse':
      return theme.colors.inkInverse
    case 'danger':
      return theme.colors.danger
    case 'success':
      return theme.colors.success
    case 'warning':
      return theme.colors.warning
    default:
      return theme.colors.ink
  }
}

export function Text({ variant = 'body', tone = 'ink', align, style, ...rest }: TextProps) {
  const theme = useTheme()
  return (
    <RNText
      {...rest}
      style={[
        theme.text[variant],
        { color: toneColor(theme, tone) },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  )
}
