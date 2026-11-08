import { Stack, useSegments, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TamaguiProvider, useTheme } from 'tamagui'
import { selectIsAuthenticated, useAuthStore } from '../src/store/auth-store'
import { bootstrapStores } from '../src/store/bootstrap'
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
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
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
  }, [isAuthenticated, segments])

  return <ThemedStack />
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const theme = colorScheme === 'dark' ? 'dark' : 'light'
  const [storesReady, setStoresReady] = useState(false)

  useEffect(() => {
    bootstrapStores().finally(() => {
      setStoresReady(true)
    })
  }, [])

  // Every store is migrated and hydrated before any screen renders
  if (!storesReady) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={theme}>
        <RootNavigator />
      </TamaguiProvider>
    </GestureHandlerRootView>
  )
}
