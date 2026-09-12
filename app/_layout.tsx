import { Stack, useSegments, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TamaguiProvider, useTheme } from 'tamagui'
import { PlannerProvider } from '../src/store/planner-store'
import { AuthProvider, useAuth } from '../src/store/auth-store'
import { ProfileProvider } from '../src/store/profile-store'
import { runStorageMigrations } from '../src/store/store-utils'
import { config } from '../tamagui.config'

function ThemedStack() {
  const theme = useTheme()
  const colorScheme = useColorScheme()

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: theme.color12?.val,
          headerStyle: {
            backgroundColor: theme.background?.val,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: theme.background?.val,
          },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="search"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'none',
          }}
        />
        <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
        <Stack.Screen name="course/new" options={{ title: 'New course' }} />
        <Stack.Screen name="task/new" options={{ title: 'New task' }} />
        <Stack.Screen name="settings-page" options={{ title: 'Settings' }} />
      </Stack>
    </>
  )
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const rootSegment = String(segments[0] ?? '')
    const isProtectedRoute =
      rootSegment === '(tabs)' ||
      rootSegment === 'course' ||
      rootSegment === 'task' ||
      rootSegment === 'settings-page' ||
      rootSegment === 'search'

    if (!isAuthenticated && isProtectedRoute) {
      // Redirect to login if not authenticated and trying to access protected route
      router.replace('/login')
    } else if (isAuthenticated && rootSegment === 'login') {
      // Redirect to app if authenticated and on login page
      router.replace('/(tabs)')
    }
  }, [isAuthenticated, segments, isLoading])

  return <ThemedStack />
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const theme = colorScheme === 'dark' ? 'dark' : 'light'
  const [migrationsComplete, setMigrationsComplete] = useState(false)

  useEffect(() => {
    runStorageMigrations().finally(() => {
      setMigrationsComplete(true)
    })
  }, [])

  // Wait for migrations before rendering providers
  if (!migrationsComplete) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={theme}>
        <AuthProvider>
          <ProfileProvider>
            <PlannerProvider>
              <RootNavigator />
            </PlannerProvider>
          </ProfileProvider>
        </AuthProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>
  )
}
