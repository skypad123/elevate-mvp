import type { AuthUser, ProfileRole, ProfileStatus, ProfileSummary } from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { isProfileOwner, TEACH_BANNER_HIDE_MS, useTeachBanner } from '@/lib/teach-banner'
import { readDismissedAt, writeDismissedAt } from '@/lib/teach-banner-storage'
import { tokenStorage } from '@/lib/token-storage'
import { jsonResponse, offline } from '@/test-utils/api'
import { TestProviders } from '@/test-utils/providers'

jest.mock('@/lib/teach-banner-storage', () => ({
  readDismissedAt: jest.fn(),
  writeDismissedAt: jest.fn(),
}))

const read = readDismissedAt as jest.Mock
const write = writeDismissedAt as jest.Mock
const getMe = api.auth.me.$get as unknown as jest.Mock

const NOW = new Date('2026-11-19T09:00:00.000Z').getTime()
const DAY = 24 * 60 * 60 * 1000

const user = (profiles: ProfileSummary[] = []): AuthUser => ({
  id: 'u1',
  email: 'learner@example.com',
  name: null,
  avatarUrl: null,
  roles: [],
  profiles,
  locale: 'en',
  localeChosen: true,
  createdAt: '2026-11-17T00:00:00.000Z',
})

const profile = (role: ProfileRole, status: ProfileStatus): ProfileSummary => ({
  id: 'p1',
  type: 'personal',
  displayName: 'Studio',
  role,
  status,
})

function Probe({ searching = false, loaded = true }: { searching?: boolean; loaded?: boolean }) {
  const { status } = useSession()
  const { visible, dismiss } = useTeachBanner({ searching, loaded })
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="visible">{String(visible)}</Text>
      <Pressable testID="dismiss" onPress={dismiss} />
    </>
  )
}

const visible = () => screen.getByTestId('visible').props.children as string
const status = () => screen.getByTestId('status').props.children as string

async function launch(props: { searching?: boolean; loaded?: boolean } = {}) {
  await render(
    <TestProviders>
      <Probe {...props} />
    </TestProviders>,
  )
  await waitFor(() => expect(status()).not.toBe('loading'))
  // Let the stored time's read settle
  await act(async () => {})
}

async function signedInAs(account: AuthUser | 'unreachable') {
  await tokenStorage.set('token')
  if (account === 'unreachable') getMe.mockImplementation(offline)
  else getMe.mockResolvedValue(jsonResponse({ user: account }))
}

beforeEach(async () => {
  jest.clearAllMocks()
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] })
  await AsyncStorage.clear()
  await tokenStorage.clear()
  getMe.mockResolvedValue(jsonResponse({ error: { code: 'unauthorized', message: '' } }, 401))
  read.mockResolvedValue(null)
  write.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('isProfileOwner', () => {
  it('is true only for an owner, whatever the status', () => {
    expect(isProfileOwner(null)).toBe(false)
    expect(isProfileOwner(user())).toBe(false)
    expect(isProfileOwner(user([profile('writer', 'approved')]))).toBe(false)
    expect(isProfileOwner(user([profile('manager', 'approved')]))).toBe(false)
    expect(isProfileOwner(user([profile('owner', 'approved')]))).toBe(true)
    expect(isProfileOwner(user([profile('owner', 'applied')]))).toBe(true)
    expect(isProfileOwner(user([profile('owner', 'rejected')]))).toBe(true)
  })
})

describe('useTeachBanner', () => {
  it('shows for a signed-out visitor', async () => {
    await launch()
    expect(status()).toBe('signed_out')
    expect(visible()).toBe('true')
  })

  it('shows for a writer on someone else’s profile', async () => {
    await signedInAs(user([profile('writer', 'approved')]))
    await launch()
    expect(status()).toBe('signed_in')
    expect(visible()).toBe('true')
  })

  it('shows for a session signed in with no user (the account could not be loaded)', async () => {
    await signedInAs('unreachable')
    await launch()
    expect(status()).toBe('signed_in')
    expect(visible()).toBe('true')
  })

  it.each([['approved'], ['applied']] as const)(
    'is hidden from the owner of an %s profile',
    async (profileStatus) => {
      await signedInAs(user([profile('owner', profileStatus)]))
      await launch()
      expect(status()).toBe('signed_in')
      expect(visible()).toBe('false')
    },
  )

  it('is hidden while the session loads', async () => {
    await tokenStorage.set('token')
    getMe.mockReturnValue(new Promise(() => {}))
    await render(
      <TestProviders>
        <Probe />
      </TestProviders>,
    )
    await act(async () => {})
    expect(status()).toBe('loading')
    expect(visible()).toBe('false')
  })

  it('is hidden until the stored time has been read', async () => {
    let resolveRead: (at: number | null) => void = () => {}
    read.mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve
      }),
    )
    await launch()
    expect(visible()).toBe('false')
    await act(async () => {
      resolveRead(null)
    })
    expect(visible()).toBe('true')
  })

  it('is hidden while searching, and until the first page has loaded', async () => {
    await launch({ searching: true })
    expect(visible()).toBe('false')
    await screen.rerender(
      <TestProviders>
        <Probe loaded={false} />
      </TestProviders>,
    )
    expect(visible()).toBe('false')
    await screen.rerender(
      <TestProviders>
        <Probe />
      </TestProviders>,
    )
    expect(visible()).toBe('true')
  })

  it('hides at once when closed, and stores the time', async () => {
    await launch()
    expect(visible()).toBe('true')
    await act(async () => {
      fireEvent.press(screen.getByTestId('dismiss'))
    })
    expect(visible()).toBe('false')
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(NOW)
  })

  it('stays hidden 29 days after it was closed, and shows again at 30', async () => {
    read.mockResolvedValue(NOW - 29 * DAY)
    await launch()
    expect(visible()).toBe('false')
    await screen.unmount()

    read.mockResolvedValue(NOW - TEACH_BANNER_HIDE_MS)
    await launch()
    expect(visible()).toBe('true')
  })
})
