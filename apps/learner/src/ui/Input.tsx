import { useState } from 'react'
import { TextInput, type TextInputProps, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from './Text'

export type InputProps = TextInputProps & {
  label?: string
  error?: string | null
  helper?: string
}

export function Input({ label, error, helper, style, onFocus, onBlur, ...rest }: InputProps) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)
  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.brand
      : theme.colors.borderStrong
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="smallStrong" tone="secondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.inkTertiary}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        {...rest}
        style={[
          theme.text.body,
          {
            height: 48,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor,
            borderRadius: theme.radii.control,
            backgroundColor: theme.colors.surface,
            color: theme.colors.ink,
          },
          rest.multiline
            ? { height: undefined, minHeight: 120, paddingVertical: 12, textAlignVertical: 'top' }
            : null,
          style,
        ]}
      />
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="small" tone="tertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  )
}
