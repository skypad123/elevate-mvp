import type { AuthUser } from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'
import { api } from '@/lib/api'
import { usePreferences } from '@/lib/preferences'
import { useSession } from '@/lib/session'
import { tokenStorage } from '@/lib/token-storage'
import { jsonResponse, offline } from '@/test-utils/api'
import { setMockDeviceLanguages } from '@/test-utils/device-languages'
import { TestProviders } from '@/test-utils/providers'

const patchMe = api.me.$patch as unknown as jest.Mock
const getMe = api.auth.me.$get as unknown as jest.Mock
const signOutPost = api.auth['sign-out'].$post as unknown as jest.Mock

const user = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1',
  email: 'learner@example.com',
  name: null,
  avatarUrl: null,
  roles: [],
  profiles: [],
  locale: 'en',
  localeChosen: false,
  createdAt: '2026-11-17T00:00:00.000Z',
  ...over,
})

function Probe() {
  const { status, chooseLocale, signOut } = useSession()
  const { locale } = usePreferences()
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="resolved">{locale}</Text>
      <Pressable testID="choose-zh" onPress={() => void chooseLocale('zh')} />
      <Pressable testID="choose-system" onPress={() => void chooseLocale('system')} />
      <Pressable testID="sign-out" onPress={() => void signOut()} />
    </>
  )
}

const renderApp = () =>
  render(
    <TestProviders>
      <Probe />
    </TestProviders>,
  )
const text = (id: string) => screen.getByTestId(id).props.children as string
const press = (id: string) =>
  act(async () => {
    fireEvent.press(screen.getByTestId(id))
  })
/** Signed in as `account`, as a launch with a stored token finds it. */
async function launchSignedIn(account: AuthUser) {
  await tokenStorage.set('token')
  getMe.mockResolvedValue(jsonResponse({ user: account }))
  await renderApp()
  await waitFor(() => expect(text('status')).toBe('signed_in'))
}

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  await tokenStorage.clear()
  patchMe.mockImplementation(async ({ json }: { json: Partial<AuthUser> }) =>
    jsonResponse({ user: user(json) }),
  )
  signOutPost.mockResolvedValue(jsonResponse({ ok: true }))
})

describe('the account language', () => {
  it('sends a chosen language when signed in', async () => {
    await launchSignedIn(user())
    await press('choose-zh')
    expect(patchMe).toHaveBeenCalledTimes(1)
    expect(patchMe).toHaveBeenCalledWith({ json: { locale: 'zh', localeChosen: true } })
    expect(text('resolved')).toBe('zh')
  })

  it('sends only that the language is no longer chosen for "Follow device"', async () => {
    await launchSignedIn(user({ locale: 'zh', localeChosen: true }))
    await press('choose-system')
    expect(patchMe).toHaveBeenCalledWith({ json: { localeChosen: false } })
  })

  it('sends nothing when signed out', async () => {
    getMe.mockResolvedValue(jsonResponse({ user: user() }))
    await renderApp()
    await waitFor(() => expect(text('status')).toBe('signed_out'))
    await press('choose-zh')
    expect(patchMe).not.toHaveBeenCalled()
    expect(text('resolved')).toBe('zh')
  })

  it("fills in an account with no language once, with this device's guess", async () => {
    setMockDeviceLanguages(['zh-CN'])
    await launchSignedIn(user({ locale: null }))
    await waitFor(() => expect(patchMe).toHaveBeenCalledTimes(1))
    expect(patchMe).toHaveBeenCalledWith({ json: { locale: 'zh', localeChosen: false } })
  })

  it('sends nothing at launch for an account that has a language', async () => {
    await launchSignedIn(user({ locale: 'en' }))
    // Give any effect a chance to run.
    await act(async () => {})
    expect(patchMe).not.toHaveBeenCalled()
  })

  it('sends nothing when the launch is offline', async () => {
    await tokenStorage.set('token')
    getMe.mockImplementation(offline)
    await renderApp()
    await waitFor(() => expect(text('status')).toBe('signed_in'))
    await act(async () => {})
    expect(patchMe).not.toHaveBeenCalled()
  })

  it("shows an account's chosen language on a device that never chose one", async () => {
    setMockDeviceLanguages(['en-SG'])
    await launchSignedIn(user({ locale: 'zh', localeChosen: true }))
    await waitFor(() => expect(text('resolved')).toBe('zh'))
    // and signing out drops it
    await press('sign-out')
    await waitFor(() => expect(text('resolved')).toBe('en'))
  })

  it('ignores a language write that answers after sign-out', async () => {
    await launchSignedIn(user())
    let answer: (value: unknown) => void = () => {}
    patchMe.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    await press('choose-zh')
    await press('sign-out')
    await act(async () => {
      answer(jsonResponse({ user: user({ locale: 'zh', localeChosen: true }) }))
    })
    expect(text('status')).toBe('signed_out')
  })
})
