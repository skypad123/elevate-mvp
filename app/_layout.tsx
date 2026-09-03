import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TamaguiProvider, useTheme } from 'tamagui'
import { PlannerProvider } from '../src/store/planner-store'
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
        <Stack.Screen name="course/new" options={{ title: 'New course' }} />
        <Stack.Screen name="task/new" options={{ title: 'New task' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const theme = colorScheme === 'dark' ? 'dark' : 'light'

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={theme}>
        <PlannerProvider>
          <ThemedStack />
        </PlannerProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>
  )
}
