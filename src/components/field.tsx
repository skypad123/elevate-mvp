import type { ReactNode } from 'react'
import { Input, TextArea, YStack } from 'tamagui'
import { Eyebrow } from './chrome'

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <YStack gap="$2">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </YStack>
  )
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const shared = {
    value,
    onChangeText,
    placeholder,
    backgroundColor: '$color2',
    borderColor: '$color4',
    borderWidth: 1,
    borderRadius: '$2',
    color: '$color12',
    placeholderTextColor: '$color9',
  } as const

  return (
    <Field label={label}>
      {multiline ? <TextArea {...shared} minHeight={96} /> : <Input {...shared} />}
    </Field>
  )
}
