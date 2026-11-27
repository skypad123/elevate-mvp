import { act, screen, waitFor } from '@testing-library/react-native'
import { Stack } from 'expo-router'
import { renderRouter, screen as routerScreen } from 'expo-router/testing-library'
import { Text } from 'react-native'
import { readInitialPath } from '@/lib/initial-path'
import { needsSignIn, useSignInForOpenedLink } from '@/lib/sign-in-redirect'

jest.mock('@/lib/initial-path', () => ({ readInitialPath: jest.fn() }))
const initialPath = readInitialPath as jest.Mock

/** The root layout's shape: Explore open to all, checkout behind the sign-in guard. */
function TestLayout({ isSignedIn }: { isSignedIn: boolean }) {
  useSignInForOpenedLink({ ready: true, isSignedIn })
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" />
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="checkout/success" />
      </Stack.Protected>
    </Stack>
  )
}
const SignedOutLayout = () => <TestLayout isSignedIn={false} />
const SignedInLayout = () => <TestLayout isSignedIn />

const routes = (isSignedIn: boolean) => ({
  _layout: isSignedIn ? SignedInLayout : SignedOutLayout,
  index: () => <Text>Explore</Text>,
  'sign-in': () => <Text>Sign in</Text>,
  'checkout/success': () => <Text>Confirming</Text>,
})

describe('a signed-out visitor who opens a protected link', () => {
  it('goes to sign-in with the whole address to come back to, lang included', async () => {
    const opened = '/checkout/success?session_id=cs_1&lang=zh'
    initialPath.mockResolvedValue(opened)
    await renderRouter(routes(false), { initialUrl: opened })
    await waitFor(() => expect(routerScreen).toHavePathname('/sign-in'))
    expect(routerScreen).toHaveSearchParams({ redirect: opened })
    expect(screen.getByText('Sign in')).toBeTruthy()
  })

  it('stays on Explore when the app opened on a public address', async () => {
    initialPath.mockResolvedValue('/')
    await renderRouter(routes(false), { initialUrl: '/' })
    await act(async () => {})
    expect(routerScreen).toHavePathname('/')
  })

  it('opens the page when signed in', async () => {
    initialPath.mockResolvedValue('/checkout/success?session_id=cs_1')
    await renderRouter(routes(true), { initialUrl: '/checkout/success?session_id=cs_1' })
    await act(async () => {})
    expect(routerScreen).toHavePathname('/checkout/success')
  })
})

describe('needsSignIn', () => {
  it('matches the routes the layouts guard', () => {
    for (const path of [
      '/learning',
      '/profile',
      '/checkout/abc',
      '/checkout/success?x=1',
      '/learn/e/lesson/l',
      '/class/e1',
      '/class/e1/',
    ])
      expect(needsSignIn(path)).toBe(true)
    for (const path of [
      '/',
      '/course/sourdough',
      '/c/TOKEN',
      '/sign-in',
      '/learning-paths',
      // The check-in screen opens signed out, to offer the app or sign-in.
      '/class/check-in/b1',
      '/class/check-in/b1?c=ABCDEFGHJKMNPQRSTVWX',
    ])
      expect(needsSignIn(path)).toBe(false)
  })
})
