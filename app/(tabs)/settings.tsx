import { router } from 'expo-router'
import { Alert } from 'react-native'
import { Button, Paragraph, YStack } from 'tamagui'
import { Eyebrow, ScreenHeader } from '../../src/components/chrome'
import { Screen } from '../../src/components/screen'
import { useAuth } from '../../src/store/auth-store'

export default function SettingsScreen() {
  const { signOut } = useAuth()

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut()
            router.replace('/login')
          },
        },
      ],
      { cancelable: true }
    )
  }

  return (
    <Screen scroll>
      <ScreenHeader eyebrow="Elvate" title="Settings" />

      <YStack gap="$4" paddingTop="$4">
        {/* Account Section */}
        <YStack gap="$3">
          <Eyebrow>Account</Eyebrow>
          <Button
            size="$4"
            borderRadius={4}
            backgroundColor="$color2"
            borderWidth={1}
            borderColor="$color4"
            color="$color12"
            onPress={handleSignOut}
            pressStyle={{ opacity: 0.88 }}
          >
            Sign Out
          </Button>
        </YStack>

        {/* App Info Section */}
        <YStack gap="$3">
          <Eyebrow>About</Eyebrow>
          <YStack
            backgroundColor="$color2"
            borderWidth={1}
            borderColor="$color4"
            borderRadius={4}
            padding="$4"
            gap="$2"
          >
            <Paragraph color="$color12" fontWeight="600">
              Elevate MVP
            </Paragraph>
            <Paragraph color="$color10" fontSize="$3">
              Version 1.0.0
            </Paragraph>
          </YStack>
        </YStack>
      </YStack>
    </Screen>
  )
}
