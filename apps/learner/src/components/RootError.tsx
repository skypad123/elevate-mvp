import type { ErrorBoundaryProps } from 'expo-router'
import { ShieldAlert } from 'lucide-react-native'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PreferencesProvider, useT } from '@/lib/preferences'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { EmptyState, Screen } from '@/ui'

/**
 * Rendered by expo-router when a route throws; wraps its own providers since the layout failed.
 * PreferencesProvider gives it the translator and the stored theme; on native it renders with the
 * defaults until the storage read finishes.
 */
export function RootError(props: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <ThemeProvider>
          <RootErrorScreen {...props} />
        </ThemeProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  )
}

function RootErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const t = useT()
  // The thrown error's message is English (an API sentence or a developer's), so it is logged, not shown
  useEffect(() => {
    if (__DEV__) console.error(error)
  }, [error])
  return (
    <Screen maxWidth={560} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <EmptyState
        icon={ShieldAlert}
        tone="danger"
        title={t('learnerCommon.rootError.title')}
        body={t('learnerCommon.rootError.body')}
        action={{ label: t('learnerCommon.error.retry'), onPress: () => void retry() }}
      />
    </Screen>
  )
}
