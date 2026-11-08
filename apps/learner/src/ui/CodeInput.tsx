import { useRef, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { Text } from './Text'

export type CodeInputProps = {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  error?: string | null
}

/** Six boxes backed by one hidden input, so paste and autofill work on every platform. */
export function CodeInput({ length = 6, value, onChange, onComplete, error }: CodeInputProps) {
  const theme = useTheme()
  const ref = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  const slots = Array.from({ length }, (_, i) => ({
    id: `slot-${i}`,
    digit: value[i] ?? '',
    index: i,
  }))

  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => ref.current?.focus()} style={{ flexDirection: 'row', gap: 8 }}>
        {slots.map((slot) => {
          const active = focused && slot.index === Math.min(value.length, length - 1)
          return (
            <View
              key={slot.id}
              style={{
                flex: 1,
                height: 56,
                borderRadius: theme.radii.control,
                borderWidth: active ? 2 : 1,
                borderColor: error
                  ? theme.colors.danger
                  : active
                    ? theme.colors.brand
                    : theme.colors.borderStrong,
                backgroundColor: theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="price">{slot.digit}</Text>
            </View>
          )
        })}
      </Pressable>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => {
          const next = text.replace(/\D/g, '').slice(0, length)
          onChange(next)
          if (next.length === length) onComplete?.(next)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  )
}
