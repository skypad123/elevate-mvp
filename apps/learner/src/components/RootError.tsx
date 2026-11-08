import type { ErrorBoundaryProps } from 'expo-router'
import { ShieldAlert } from 'lucide-react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { EmptyState, Screen } from '@/ui'

/** Rendered by expo-router when a route throws; wraps its own providers since the layout failed. */
export function RootError({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Screen maxWidth={560} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={ShieldAlert}
            tone="danger"
            title="Something went wrong"
            body={error.message || 'An unexpected error interrupted this screen.'}
            action={{ label: 'Try again', onPress: () => void retry() }}
          />
        </Screen>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
