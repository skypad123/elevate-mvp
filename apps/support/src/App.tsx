import { ToastProvider } from '@elevate/web-ui'
import { PortalAuthProvider } from '@elevate/web-ui/portal'
import { PreferencesProvider } from '@elevate/web-ui/preferences'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { api, tokenStore } from './lib/api'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

export function App() {
  return (
    // Preferences sit outside auth so the sign-in page is themed and translated too.
    <PreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <PortalAuthProvider api={api} tokenStore={tokenStore} audience="support">
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </PortalAuthProvider>
      </QueryClientProvider>
    </PreferencesProvider>
  )
}
