import { Stack, useSegments, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TamaguiProvider, useTheme } from 'tamagui'
import { PlannerProvider } from '../src/store/planner-store'
import { AuthProvider, useAuth } from '../src/store/auth-store'
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
        <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
        <Stack.Screen name="course/new" options={{ title: 'New course' }} />
        <Stack.Screen name="task/new" options={{ title: 'New task' }} />
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

    const inAuthGroup = segments[0] === '(tabs)'

    if (!isAuthenticated && inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login')
    } else if (isAuthenticated && !inAuthGroup) {
      // Redirect to app if authenticated
      router.replace('/(tabs)')
    }
  }, [isAuthenticated, segments, isLoading])

  return <ThemedStack />
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const theme = colorScheme === 'dark' ? 'dark' : 'light'

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={theme}>
        <AuthProvider>
          <PlannerProvider>
            <RootNavigator />
          </PlannerProvider>
        </AuthProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>
  )
}
