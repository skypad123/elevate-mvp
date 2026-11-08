import type { LucideIcon } from 'lucide-react-native'
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from './Text'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: LucideIcon
  iconRight?: LucideIcon
  fullWidth?: boolean
}

const sizes: Record<
  ButtonSize,
  { height: number; paddingHorizontal: number; font: 'small' | 'bodyStrong' | 'bodyLg' }
> = {
  sm: { height: 36, paddingHorizontal: 14, font: 'small' },
  md: { height: 46, paddingHorizontal: 18, font: 'bodyStrong' },
  lg: { height: 54, paddingHorizontal: 22, font: 'bodyLg' },
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme()
  const { colors } = theme
  const palette = {
    primary: { bg: colors.brand, fg: colors.brandInk, border: colors.brand },
    accent: { bg: colors.accent, fg: colors.accentInk, border: colors.accent },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.brand, border: 'transparent' },
    danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
  }[variant]
  const s = sizes[size]
  const isDisabled = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.paddingHorizontal,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: theme.radii.control,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {Icon ? (
              <Icon size={size === 'sm' ? 16 : 18} color={palette.fg} strokeWidth={2.2} />
            ) : null}
            <Text
              variant={s.font}
              style={{ color: palette.fg, fontFamily: theme.text.bodyStrong.fontFamily }}
            >
              {label}
            </Text>
            {IconRight ? (
              <IconRight size={size === 'sm' ? 16 : 18} color={palette.fg} strokeWidth={2.2} />
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
