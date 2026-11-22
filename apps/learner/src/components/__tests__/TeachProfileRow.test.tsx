import type { AuthUser, ProfileRole } from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { renderRouter, screen } from 'expo-router/testing-library'
import { Text } from 'react-native'
import { TeachProfileRow } from '@/components/TeachProfileRow'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { tokenStorage } from '@/lib/token-storage'
import { jsonResponse } from '@/test-utils/api'
import { TestProviders } from '@/test-utils/providers'

const getMe = api.auth.me.$get as unknown as jest.Mock

const user = (role?: ProfileRole): AuthUser => ({
  id: 'u1',
  email: 'learner@example.com',
  name: null,
  avatarUrl: null,
  roles: [],
  profiles: role
    ? [{ id: 'p1', type: 'personal', displayName: 'Studio', role, status: 'approved' }]
    : [],
  locale: 'en',
  localeChosen: true,
  createdAt: '2026-11-17T00:00:00.000Z',
})

function ProfileTab() {
  const { status } = useSession()
  return (
    <>
      <Text testID="status">{status}</Text>
      <TeachProfileRow />
    </>
  )
}

async function renderSignedInAs(account: AuthUser) {
  await tokenStorage.set('token')
  getMe.mockResolvedValue(jsonResponse({ user: account }))
  await renderRouter(
    { index: ProfileTab, teach: () => <Text testID="teach-screen" /> },
    { initialUrl: '/', wrapper: TestProviders },
  )
  await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signed_in'))
}

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  await tokenStorage.clear()
})

describe('TeachProfileRow', () => {
  it('shows nothing to the owner of a teaching profile', async () => {
    await renderSignedInAs(user('owner'))
    expect(screen.queryByTestId('profile-teach-open')).toBeNull()
  })

  it.each([
    ['a learner', undefined],
    ['a writer', 'writer'],
  ] as const)('opens /teach for %s', async (_, role) => {
    await renderSignedInAs(user(role))
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-teach-open'))
    })
    expect(screen).toHavePathname('/teach')
  })
})
