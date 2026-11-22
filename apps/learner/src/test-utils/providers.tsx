import { QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { PreferencesProvider } from '@/lib/preferences'
import { queryClient } from '@/lib/query-client'
import { SessionProvider } from '@/lib/session'
import { ThemeProvider } from '@/theme/ThemeProvider'

/** The providers the root layout wraps every screen in, in the same order. */
export function TestProviders({ children }: PropsWithChildren) {
  return (
    <PreferencesProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>{children}</SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </PreferencesProvider>
  )
}
