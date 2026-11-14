import { RequireAuth, RouteError, SignInPage, VerifyPage } from '@elevate/web-ui/portal'
import { createBrowserRouter } from 'react-router'
import { api } from './lib/api'
import { ProfileProvider } from './lib/profile'
import { ApplyPage } from './routes/apply'
import { CorporateApplyPage, CorporateReapplyPage } from './routes/apply-corporate'
import { CourseBuilder } from './routes/courses/builder'
import { CourseChangesPage } from './routes/courses/changes'
import { CoursesPage } from './routes/courses/list'
import { Dashboard } from './routes/dashboard'
import { CourseEarningsPage, EarningsPage } from './routes/earnings'
import { HomeRedirect, OnboardingLayout, ProfileGate, StartPage } from './routes/gate'
import { InvitationPage } from './routes/invitation'
import { MembersPage } from './routes/members'
import { SettingsPage } from './routes/settings'
import { StripeRefresh, StripeReturn } from './routes/stripe'

/**
 * A few pages sit outside a profile: the home redirect, the start page for someone on no profile,
 * the application forms, and the page an invitation link opens (the invitee is not on the profile
 * yet, and may not be signed in).
 * Everything else is under `/p/:profileId`, so the profile a page acts on is always in its URL.
 */
export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
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
      { path: '/invitations/:token', element: <InvitationPage /> },
      {
        index: true,
        element: (
          <RequireAuth>
            <HomeRedirect />
          </RequireAuth>
        ),
      },
      {
        element: (
          <RequireAuth>
            <OnboardingLayout />
          </RequireAuth>
        ),
        children: [
          { path: 'start', element: <StartPage /> },
          { path: 'apply', element: <ApplyPage /> },
          { path: 'apply/company', element: <CorporateApplyPage /> },
        ],
      },
      {
        path: 'p/:profileId',
        element: (
          <RequireAuth>
            <ProfileProvider>
              <ProfileGate />
            </ProfileProvider>
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Dashboard /> },
          // A company's application, reopened by its owner until the profile is approved.
          { path: 'apply', element: <CorporateReapplyPage /> },
          { path: 'courses', element: <CoursesPage /> },
          { path: 'courses/:id', element: <CourseBuilder /> },
          { path: 'courses/:id/changes', element: <CourseChangesPage /> },
          { path: 'earnings', element: <EarningsPage /> },
          { path: 'earnings/:courseId', element: <CourseEarningsPage /> },
          { path: 'members', element: <MembersPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'stripe/return', element: <StripeReturn /> },
          { path: 'stripe/refresh', element: <StripeRefresh /> },
        ],
      },
    ],
  },
])
