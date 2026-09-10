import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Paragraph, XStack, YStack, useTheme } from 'tamagui'
import { Chip } from '../src/components/chrome'
import { CourseCard } from '../src/components/course-card'
import {
  ConversationComposer,
  SEARCH_BAR_HEIGHT,
} from '../src/components/search-bar'
import {
  SEARCH_PROMPTS,
  getWelcomeMessage,
  replyToUser,
} from '../src/lib/course-assistant'
import { createId } from '../src/lib/id'
import { usePlanner } from '../src/store/planner-store'
import { useProfile } from '../src/store/profile-store'
import type { Course } from '../src/types'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  courses?: Course[]
}

function TypingDot({ delay, color }: { delay: number; color: string }) {
  const translateY = useSharedValue(0)

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 220, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    )
  }, [delay, translateY])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View
      style={[
        style,
        {
          width: 6,
          height: 6,
          borderRadius: 99,
          backgroundColor: color,
        },
      ]}
    />
  )
}

function TypingIndicator() {
  const theme = useTheme()
  const color = String(theme.color10?.val ?? '#888')

  return (
    <XStack alignSelf="flex-start" maxWidth="86%">
      <YStack
        backgroundColor="$color2"
        borderWidth={1}
        borderColor="$color4"
        borderRadius="$3"
        paddingHorizontal="$3"
        paddingVertical="$3"
        gap="$2"
      >
        <XStack gap="$2" alignItems="center">
          <TypingDot delay={0} color={color} />
          <TypingDot delay={120} color={color} />
          <TypingDot delay={240} color={color} />
        </XStack>
        <Paragraph color="$color10" fontSize="$2">
          Elevate is thinking…
        </Paragraph>
      </YStack>
    </XStack>
  )
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { courses, tasks } = usePlanner()
  const { profile } = useProfile()
  const theme = useTheme()
  const scrollRef = useRef<ScrollView>(null)

  const [draft, setDraft] = useState('')
  const [readyToType, setReadyToType] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: getWelcomeMessage(profile.name),
    },
  ])

  const progress = useSharedValue(0)
  const keyboardHeight = useSharedValue(0)
  const closing = useRef(false)

  const startTop = insets.top + 8

  useEffect(() => {
    const motion = {
      duration: 560,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    }
    progress.value = withTiming(1, motion, (finished) => {
      if (finished) runOnJS(setReadyToType)(true)
    })
    const fallback = setTimeout(() => {
      progress.value = 1
      setReadyToType(true)
    }, 620)
    return () => clearTimeout(fallback)
  }, [progress])

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const next = event.endCoordinates.height
        keyboardHeight.value = withTiming(next, { duration: 220 })
        setKeyboardOffset(next)
      }
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardHeight.value = withTiming(0, { duration: 220 })
        setKeyboardOffset(0)
      }
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [keyboardHeight])

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    return () => clearTimeout(timer)
  }, [messages, thinking])

  function finishClose() {
    if (!closing.current) return
    closing.current = false
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)')
    }
  }

  function handleClose() {
    if (closing.current) return
    closing.current = true
    Keyboard.dismiss()
    setReadyToType(false)
    progress.value = withTiming(
      0,
      {
        duration: 420,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      },
      (finished) => {
        if (finished) runOnJS(finishClose)()
      }
    )
    setTimeout(() => finishClose(), 500)
  }

  function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || thinking) return

    const userMessage: ChatMessage = {
      id: createId('msg'),
      role: 'user',
      text: trimmed,
    }
    setMessages((current) => [...current, userMessage])
    setDraft('')
    setThinking(true)

    const delay = 650 + Math.min(trimmed.length * 12, 700)
    setTimeout(() => {
      const reply = replyToUser(trimmed, {
        courses,
        tasks,
        profileName: profile.name,
      })
      setMessages((current) => [
        ...current,
        {
          id: createId('msg'),
          role: 'assistant',
          text: reply.text,
          courses: reply.courses,
        },
      ])
      setThinking(false)
    }, delay)
  }

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [0, 1]),
  }))

  const chatStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.45, 1], [0, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0.45, 1], [18, 0]) },
    ],
  }))

  const barStyle = useAnimatedStyle(() => {
    const bottomInset = Math.max(insets.bottom, keyboardHeight.value ? 8 : insets.bottom)
    const endTop = height - bottomInset - SEARCH_BAR_HEIGHT - keyboardHeight.value - 12
    return {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      top: interpolate(progress.value, [0, 1], [startTop, Math.max(endTop, startTop + 72)]),
    }
  })

  const background = String(theme.background?.val ?? '#fff')

  return (
    <YStack flex={1} backgroundColor="transparent">
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: background,
            pointerEvents: 'none',
          },
          overlayStyle,
          readyToType ? { opacity: 1 } : null,
        ]}
      />

      <YStack flex={1} width="100%" maxWidth={720} alignSelf="center" backgroundColor="transparent">
        <Animated.View
          style={[
            { flex: 1 },
            chatStyle,
            readyToType ? { opacity: 1, transform: [{ translateY: 0 }] } : null,
          ]}
        >
          <YStack
            flex={1}
            paddingTop={insets.top + 8}
            paddingHorizontal="$4"
            paddingBottom={SEARCH_BAR_HEIGHT + Math.max(insets.bottom, 12) + 36 + keyboardOffset}
          >
            <XStack alignItems="center" justifyContent="space-between" marginBottom="$3">
              <YStack>
                <Paragraph
                  fontFamily="$mono"
                  fontSize={11}
                  letterSpacing={2.6}
                  textTransform="uppercase"
                  color="$color10"
                >
                  elevate
                </Paragraph>
                <Paragraph color="$color12" fontSize="$7" fontWeight="700">
                  Ask for courses
                </Paragraph>
              </YStack>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close search"
              >
                <YStack
                  width={36}
                  height={36}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="$color2"
                  borderWidth={1}
                  borderColor="$color4"
                  borderRadius="$2"
                >
                  <Ionicons name="close" size={20} color={String(theme.color12?.val)} />
                </YStack>
              </Pressable>
            </XStack>

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 72 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => (
                <YStack
                  key={message.id}
                  alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
                  maxWidth="88%"
                  gap="$2"
                >
                  <YStack
                    backgroundColor={message.role === 'user' ? '$color12' : '$color2'}
                    borderWidth={1}
                    borderColor={message.role === 'user' ? '$color12' : '$color4'}
                    borderRadius="$3"
                    paddingHorizontal="$3"
                    paddingVertical="$3"
                  >
                    <Paragraph
                      color={message.role === 'user' ? '$background' : '$color12'}
                      fontSize="$4"
                      lineHeight={22}
                    >
                      {message.text}
                    </Paragraph>
                  </YStack>
                  {message.courses?.length ? (
                    <YStack gap="$2">
                      {message.courses.map((course) => (
                        <CourseCard key={course.id} course={course} compact />
                      ))}
                    </YStack>
                  ) : null}
                </YStack>
              ))}

              {thinking ? <TypingIndicator /> : null}

              {!thinking && messages.length === 1 ? (
                <XStack gap="$2" flexWrap="wrap" paddingTop="$2">
                  {SEARCH_PROMPTS.map((prompt) => (
                    <Chip key={prompt} onPress={() => sendMessage(prompt)}>
                      <Paragraph color="$color12" fontSize="$3">
                        {prompt}
                      </Paragraph>
                    </Chip>
                  ))}
                </XStack>
              ) : null}
            </ScrollView>
          </YStack>
        </Animated.View>

        <Animated.View
          style={
            readyToType
              ? {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: Math.max(insets.bottom, 12) + keyboardOffset,
                }
              : barStyle
          }
        >
          <YStack paddingHorizontal="$4">
            <ConversationComposer
              value={draft}
              onChangeText={setDraft}
              onSubmit={() => sendMessage(draft)}
              autoFocus={readyToType}
            />
          </YStack>
        </Animated.View>
      </YStack>
    </YStack>
  )
}
