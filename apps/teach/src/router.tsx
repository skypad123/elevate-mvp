import { RequireAuth, SignInPage, VerifyPage } from '@elevate/web-ui/portal'
import { createBrowserRouter } from 'react-router'
import { api } from './lib/api'
import { ApplyPage } from './routes/apply'
import { CourseBuilder } from './routes/courses/builder'
import { CoursesPage } from './routes/courses/list'
import { Dashboard } from './routes/dashboard'
import { OnboardingLayout, TeachGate } from './routes/gate'
import { TeachLayout } from './routes/layout'
import { PendingPage } from './routes/pending'
import { Earnings } from './routes/placeholders'
import { SettingsPage } from './routes/settings'
import { StripeRefresh, StripeReturn } from './routes/stripe'

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
        <TeachGate>
          <OnboardingLayout />
        </TeachGate>
      </RequireAuth>
    ),
    children: [
      { path: 'apply', element: <ApplyPage /> },
      { path: 'pending', element: <PendingPage /> },
    ],
  },
  {
    element: (
      <RequireAuth>
        <TeachGate>
          <TeachLayout />
        </TeachGate>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'courses', element: <CoursesPage /> },
      { path: 'courses/:id', element: <CourseBuilder /> },
      { path: 'earnings', element: <Earnings /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'stripe/return', element: <StripeReturn /> },
      { path: 'stripe/refresh', element: <StripeRefresh /> },
    ],
  },
])
