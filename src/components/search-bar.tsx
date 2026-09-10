import Ionicons from '@expo/vector-icons/Ionicons'
import type { ReactNode } from 'react'
import { Pressable } from 'react-native'
import { Input, Paragraph, XStack, YStack } from 'tamagui'

export const SEARCH_BAR_HEIGHT = 52

export function SearchBarShell({ children }: { children: ReactNode }) {
  return (
    <XStack
      alignItems="center"
      backgroundColor="$color2"
      borderWidth={1}
      borderColor="$color4"
      borderRadius="$2"
      paddingHorizontal="$3"
      height={SEARCH_BAR_HEIGHT}
      gap="$2"
    >
      {children}
    </XStack>
  )
}

export function HomeSearchBar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ask Elevate anything"
    >
      <SearchBarShell>
        <Ionicons name="sparkles-outline" size={18} color="gray" />
        <Paragraph flex={1} color="$color9" fontSize="$4">
          Ask Elevate anything...
        </Paragraph>
        <Ionicons name="search" size={18} color="gray" />
      </SearchBarShell>
    </Pressable>
  )
}

export function ConversationComposer({
  value,
  onChangeText,
  onSubmit,
  autoFocus,
}: {
  value: string
  onChangeText: (text: string) => void
  onSubmit: () => void
  autoFocus?: boolean
}) {
  const canSend = value.trim().length > 0

  return (
    <SearchBarShell>
      <Ionicons name="sparkles-outline" size={18} color="gray" />
      <Input
        flex={1}
        value={value}
        onChangeText={onChangeText}
        placeholder="What do you want to learn?"
        backgroundColor="transparent"
        borderWidth={0}
        padding={0}
        fontSize="$4"
        placeholderTextColor="$color9"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
      />
        <YStack
          onPress={canSend ? onSubmit : undefined}
          opacity={canSend ? 1 : 0.35}
          cursor={canSend ? 'pointer' : 'default'}
          padding="$1"
        >
          <Ionicons name="arrow-up-circle" size={26} color="gray" />
        </YStack>
    </SearchBarShell>
  )
}
