import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, TouchableOpacity } from 'react-native'
import { Avatar, Button, H4, Input, Paragraph, YStack, XStack } from 'tamagui'
import { Eyebrow, ScreenHeader } from '../../src/components/chrome'
import { Screen } from '../../src/components/screen'
import { useProfile } from '../../src/store/profile-store'

export default function ProfileScreen() {
  const { profile, updateProfile } = useProfile()
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(profile.name)

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      try {
        await updateProfile({ imageUri: result.assets[0].uri })
      } catch (error) {
        Alert.alert('Error', 'Failed to update profile image')
      }
    }
  }

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Name cannot be empty')
      return
    }

    try {
      await updateProfile({ name: editedName.trim() })
      setIsEditing(false)
    } catch (error) {
      Alert.alert('Error', 'Failed to update name')
    }
  }

  const handleCancelEdit = () => {
    setEditedName(profile.name)
    setIsEditing(false)
  }

  return (
    <Screen scroll>
      <ScreenHeader 
        eyebrow="Elevate" 
        title="Profile"
        action={
          <TouchableOpacity
            onPress={() => router.push('/settings-page')}
            style={{ padding: 8 }}
          >
            <Ionicons name="settings-outline" size={24} color="gray" />
          </TouchableOpacity>
        }
      />

      <YStack gap="$5" paddingTop="$4">
        {/* Profile Image Section */}
        <YStack alignItems="center" gap="$3">
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
            <YStack position="relative">
              <Avatar circular size="$10">
                {profile.imageUri && (
                  <Avatar.Image source={{ uri: profile.imageUri }} />
                )}
                <Avatar.Fallback backgroundColor="$color8">
                  <Paragraph fontSize="$8" color="$color12" fontWeight="600">
                    {profile.name.charAt(0).toUpperCase()}
                  </Paragraph>
                </Avatar.Fallback>
              </Avatar>
              <YStack
                position="absolute"
                bottom={0}
                right={0}
                backgroundColor="$color12"
                borderRadius={20}
                padding="$2"
                borderWidth={2}
                borderColor="$background"
              >
                <Ionicons name="camera" size={16} color="white" />
              </YStack>
            </YStack>
          </TouchableOpacity>
          <Paragraph color="$color10" fontSize="$2">
            Tap to change photo
          </Paragraph>
        </YStack>

        {/* Name Section */}
        <YStack gap="$3">
          <Eyebrow>Name</Eyebrow>
          {isEditing ? (
            <YStack gap="$3">
              <Input
                value={editedName}
                onChangeText={setEditedName}
                backgroundColor="$color2"
                borderColor="$color4"
                borderWidth={1}
                borderRadius="$2"
                color="$color12"
                size="$4"
                autoFocus
              />
              <XStack gap="$2">
                <Button
                  flex={1}
                  size="$4"
                  borderRadius={4}
                  backgroundColor="$color12"
                  color="$background"
                  onPress={handleSaveName}
                  pressStyle={{ opacity: 0.88 }}
                >
                  Save
                </Button>
                <Button
                  flex={1}
                  size="$4"
                  borderRadius={4}
                  backgroundColor="$color2"
                  borderWidth={1}
                  borderColor="$color4"
                  color="$color12"
                  onPress={handleCancelEdit}
                  pressStyle={{ opacity: 0.88 }}
                >
                  Cancel
                </Button>
              </XStack>
            </YStack>
          ) : (
            <YStack
              backgroundColor="$color2"
              borderWidth={1}
              borderColor="$color4"
              borderRadius={4}
              padding="$4"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <H4 color="$color12" fontWeight="600">
                  {profile.name}
                </H4>
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="pencil" size={20} color="gray" />
                </TouchableOpacity>
              </XStack>
            </YStack>
          )}
        </YStack>

        {/* Additional Info Section */}
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
              Student Planner
            </Paragraph>
          </YStack>
        </YStack>
      </YStack>
    </Screen>
  )
}
