import { RequireAuth, RouteError, SignInPage, VerifyPage } from '@elevate/web-ui/portal'
import { createBrowserRouter, Navigate } from 'react-router'
import { api } from './lib/api'
import { AuditLogPage } from './routes/audit'
import { InsightsPage } from './routes/insights'
import { SupportLayout } from './routes/layout'
import { People } from './routes/people'
import { Person } from './routes/person'
import { Profile } from './routes/profile'
import { Profiles } from './routes/profiles'
import { ReviewCourse } from './routes/review-course'
import { ReviewQueue } from './routes/review-queue'
import { TransactionDetailPage, TransactionsPage } from './routes/transactions'

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        path: '/sign-in',
        element: (
          <SignInPage
            api={api}
            audience="support"
            portalName="Elevate Support"
            blurb="Internal tools: review courses, approve teachers, manage payments."
          />
        ),
      },
      { path: '/verify', element: <VerifyPage api={api} /> },
      {
        element: (
          <RequireAuth>
            <SupportLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="/review" replace /> },
          { path: 'review', element: <ReviewQueue /> },
          { path: 'review/:courseId', element: <ReviewCourse /> },
          { path: 'people', element: <People /> },
          { path: 'people/:id', element: <Person /> },
          { path: 'profiles', element: <Profiles /> },
          { path: 'profiles/:id', element: <Profile /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'transactions/:id', element: <TransactionDetailPage /> },
          { path: 'audit', element: <AuditLogPage /> },
          { path: 'insights', element: <InsightsPage /> },
        ],
      },
    ],
  },
])
