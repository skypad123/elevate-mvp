import { RequireAuth, SignInPage, VerifyPage } from '@elevate/web-ui/portal'
import { createBrowserRouter, Navigate } from 'react-router'
import { api } from './lib/api'
import { SupportLayout } from './routes/layout'
import { People } from './routes/people'
import { Person } from './routes/person'
import { Transactions } from './routes/placeholders'
import { ReviewCourse } from './routes/review-course'
import { ReviewQueue } from './routes/review-queue'

export const router = createBrowserRouter([
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
      { path: 'transactions', element: <Transactions /> },
    ],
  },
])
