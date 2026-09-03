import { useState } from 'react'
import { Platform, Pressable } from 'react-native'
import { router } from 'expo-router'
import {
  Button,
  H2,
  Input,
  Paragraph,
  Separator,
  XStack,
  YStack,
} from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../src/components/screen'
import { Eyebrow } from '../src/components/chrome'
import { useAuth } from '../src/store/auth-store'

type AuthMode = 'signin' | 'signup'
type InputMethod = 'email' | 'phone'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [inputMethod, setInputMethod] = useState<InputMethod>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const handleAppleSignIn = async () => {
    // Mock Apple SSO - in real app would use expo-apple-authentication
    console.log('Apple Sign In pressed')
    await signIn()
    router.replace('/(tabs)')
  }

  const handleGoogleSignIn = async () => {
    // Mock Google SSO - in real app would use @react-native-google-signin/google-signin
    console.log('Google Sign In pressed')
    await signIn()
    router.replace('/(tabs)')
  }

  const handleSubmit = async () => {
    // Mock authentication
    console.log('Submit pressed', { authMode, inputMethod, email, phone })
    await signIn()
    router.replace('/(tabs)')
  }

  const isSignUp = authMode === 'signup'
  const isEmail = inputMethod === 'email'

  return (
    <Screen scroll>
      <YStack flex={1} justifyContent="center" paddingVertical="$8" gap="$6">
        {/* Header */}
        <YStack gap="$3" alignItems="center">
          <H2 color="$color12" letterSpacing={-0.6}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </H2>
          <Paragraph color="$color10" textAlign="center">
            {isSignUp
              ? 'Sign up to start planning your academic success'
              : 'Sign in to continue to Elevate'}
          </Paragraph>
        </YStack>

        {/* SSO Buttons */}
        <YStack gap="$3">
          <Eyebrow>{`Sign ${isSignUp ? 'up' : 'in'} with`}</Eyebrow>
          
          {/* Apple SSO Button */}
          <Pressable onPress={handleAppleSignIn}>
            <XStack
              backgroundColor="#000000"
              borderRadius={4}
              padding="$3.5"
              alignItems="center"
              justifyContent="center"
              gap="$3"
              cursor="pointer"
              pressStyle={{ opacity: 0.88 }}
            >
              <Ionicons
                name="logo-apple"
                size={22}
                color="#FFFFFF"
              />
              <Paragraph color="#FFFFFF" fontWeight="600" fontSize="$5">
                Continue with Apple
              </Paragraph>
            </XStack>
          </Pressable>

          {/* Google SSO Button */}
          <Pressable onPress={handleGoogleSignIn}>
            <XStack
              backgroundColor="$color2"
              borderWidth={1}
              borderColor="$color4"
              borderRadius={4}
              padding="$3.5"
              alignItems="center"
              justifyContent="center"
              gap="$3"
              cursor="pointer"
              pressStyle={{ opacity: 0.88 }}
            >
              <Ionicons
                name="logo-google"
                size={20}
                color="#EA4335"
              />
              <Paragraph color="$color12" fontWeight="600">
                Continue with Google
              </Paragraph>
            </XStack>
          </Pressable>
        </YStack>

        {/* Divider */}
        <XStack alignItems="center" gap="$3">
          <Separator flex={1} />
          <Paragraph color="$color9" fontSize="$2">
            OR
          </Paragraph>
          <Separator flex={1} />
        </XStack>

        {/* Input Method Toggle */}
        <XStack gap="$2">
          <Button
            flex={1}
            size="$3"
            borderRadius={4}
            backgroundColor={isEmail ? '$color4' : '$color2'}
            color="$color12"
            borderWidth={1}
            borderColor={isEmail ? '$color6' : '$color4'}
            onPress={() => setInputMethod('email')}
            fontWeight={isEmail ? '600' : '400'}
          >
            Email
          </Button>
          <Button
            flex={1}
            size="$3"
            borderRadius={4}
            backgroundColor={!isEmail ? '$color4' : '$color2'}
            color="$color12"
            borderWidth={1}
            borderColor={!isEmail ? '$color6' : '$color4'}
            onPress={() => setInputMethod('phone')}
            fontWeight={!isEmail ? '600' : '400'}
          >
            Phone
          </Button>
        </XStack>

        {/* Form Fields */}
        <YStack gap="$3">
          {/* Name field (only for sign up) */}
          {isSignUp && (
            <YStack gap="$2">
              <Eyebrow>Full Name</Eyebrow>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                backgroundColor="$color2"
                borderColor="$color4"
                borderWidth={1}
                borderRadius={4}
                color="$color12"
                placeholderTextColor="$color9"
                size="$4"
                autoCapitalize="words"
              />
            </YStack>
          )}

          {/* Email or Phone Input */}
          <YStack gap="$2">
            <Eyebrow>{isEmail ? 'Email Address' : 'Phone Number'}</Eyebrow>
            <Input
              value={isEmail ? email : phone}
              onChangeText={isEmail ? setEmail : setPhone}
              placeholder={
                isEmail ? 'your.email@example.com' : '+1 (555) 000-0000'
              }
              backgroundColor="$color2"
              borderColor="$color4"
              borderWidth={1}
              borderRadius={4}
              color="$color12"
              placeholderTextColor="$color9"
              size="$4"
              keyboardType={isEmail ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              autoComplete={isEmail ? 'email' : 'tel'}
            />
          </YStack>

          {/* Password Field */}
          <YStack gap="$2">
            <Eyebrow>Password</Eyebrow>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
              backgroundColor="$color2"
              borderColor="$color4"
              borderWidth={1}
              borderRadius={4}
              color="$color12"
              placeholderTextColor="$color9"
              size="$4"
              secureTextEntry
              autoCapitalize="none"
            />
          </YStack>

          {/* Forgot Password (only for sign in) */}
          {!isSignUp && (
            <Pressable onPress={() => console.log('Forgot password')}>
              <Paragraph
                color="$color11"
                fontSize="$3"
                textAlign="right"
                textDecorationLine="underline"
              >
                Forgot password?
              </Paragraph>
            </Pressable>
          )}
        </YStack>

        {/* Submit Button */}
        <Button
          size="$4"
          borderRadius={4}
          backgroundColor="$color12"
          color="$background"
          fontWeight="600"
          onPress={handleSubmit}
          pressStyle={{ opacity: 0.88 }}
        >
          {isSignUp ? 'Create Account' : 'Sign In'}
        </Button>

        {/* Terms (only for sign up) */}
        {isSignUp && (
          <Paragraph
            color="$color9"
            fontSize="$2"
            textAlign="center"
            paddingHorizontal="$4"
          >
            By signing up, you agree to our Terms of Service and Privacy Policy
          </Paragraph>
        )}

        {/* Toggle Auth Mode */}
        <XStack justifyContent="center" gap="$2">
          <Paragraph color="$color10">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </Paragraph>
          <Pressable onPress={() => setAuthMode(isSignUp ? 'signin' : 'signup')}>
            <Paragraph
              color="$color12"
              fontWeight="600"
              textDecorationLine="underline"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Paragraph>
          </Pressable>
        </XStack>
      </YStack>
    </Screen>
  )
}
