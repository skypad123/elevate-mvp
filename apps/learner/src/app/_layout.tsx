import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono'
import { QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  Stack,
} from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { RootError } from '@/components/RootError'
import { PreferencesProvider, usePreferences } from '@/lib/preferences'
import { queryClient } from '@/lib/query-client'
import { SessionProvider, useSession } from '@/lib/session'
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider'

SplashScreen.preventAutoHideAsync().catch(() => {})

export const unstable_settings = { anchor: '(tabs)' }

export const ErrorBoundary = RootError

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Fraunces-Regular': Fraunces_400Regular,
    'Fraunces-SemiBold': Fraunces_600SemiBold,
    'Fraunces-Italic': Fraunces_400Regular_Italic,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'JetBrainsMono-Medium': JetBrainsMono_500Medium,
  })

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PreferencesProvider>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <SessionProvider>
                <RootNavigator />
              </SessionProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </PreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigator() {
  const theme = useTheme()
  const { isLoading, isSignedIn } = useSession()
  const { ready: preferencesReady } = usePreferences()
  // Keep the splash up until the stored theme is known, so the app never flashes the wrong scheme.
  const booting = isLoading || !preferencesReady

  useEffect(() => {
    if (!booting) SplashScreen.hideAsync().catch(() => {})
  }, [booting])

  if (booting) return null

  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.brand,
      background: theme.colors.canvas,
      card: theme.colors.surface,
      text: theme.colors.ink,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  }

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {/* testID exposes the resolved scheme to end-to-end tests (Maestro asserts it after relaunch). */}
      <View style={{ flex: 1 }} testID={`app-root-${theme.scheme}`}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.canvas },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="course/[slug]" />
          <Stack.Screen name="c/[token]" />
          <Stack.Protected guard={!isSignedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={isSignedIn}>
            <Stack.Screen name="checkout/[courseId]" />
            <Stack.Screen name="checkout/success" />
            <Stack.Screen name="learn/[enrollmentId]/index" />
            <Stack.Screen name="learn/[enrollmentId]/lesson/[lessonId]" />
            <Stack.Screen name="learn/[enrollmentId]/certificate" />
          </Stack.Protected>
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>
    </NavigationThemeProvider>
  )
}
