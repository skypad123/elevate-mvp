import { ToastProvider } from '@elevate/web-ui'
import { PortalAuthProvider } from '@elevate/web-ui/portal'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { api, tokenStore } from './lib/api'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PortalAuthProvider api={api} tokenStore={tokenStore} audience="teach">
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </PortalAuthProvider>
    </QueryClientProvider>
  )
}
