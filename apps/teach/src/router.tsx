import { RequireAuth, SignInPage, VerifyPage } from '@elevate/web-ui/portal'
import { createBrowserRouter } from 'react-router'
import { api } from './lib/api'
import { TeachLayout } from './routes/layout'
import { Courses, Dashboard, Earnings, SettingsPage } from './routes/placeholders'

export const router = createBrowserRouter([
  {
    path: '/sign-in',
    element: (
      <SignInPage
        api={api}
        audience="teach"
        portalName="Elevate Teach"
        blurb="Author courses, submit them for review and get paid through Stripe."
      />
    ),
  },
  { path: '/verify', element: <VerifyPage api={api} /> },
  {
    element: (
      <RequireAuth>
        <TeachLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'courses', element: <Courses /> },
      { path: 'earnings', element: <Earnings /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
