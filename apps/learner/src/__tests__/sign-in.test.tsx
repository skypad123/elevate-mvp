import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import SignIn from '@/app/(auth)/sign-in'
import { api } from '@/lib/api'
import { tokenStorage } from '@/lib/token-storage'
import { jsonResponse } from '@/test-utils/api'
import { TestProviders } from '@/test-utils/providers'

const requestLink = api.auth['magic-link'].$post as unknown as jest.Mock
const getMe = api.auth.me.$get as unknown as jest.Mock

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  await tokenStorage.clear()
  getMe.mockResolvedValue(jsonResponse({ error: { code: 'unauthorized', message: '' } }, 401))
  requestLink.mockResolvedValue(jsonResponse({ ok: true }))
})

const renderSignIn = () =>
  renderRouter(
    { 'sign-in': SignIn, index: () => null },
    { initialUrl: '/sign-in', wrapper: TestProviders },
  )

describe('sign-in', () => {
  it('keeps the typed email across a switch to Chinese and asks for the code in Chinese', async () => {
    await renderSignIn()
    const email = await screen.findByTestId('sign-in-email')
    fireEvent.changeText(email, 'learner@example.com')
    await act(async () => {
      fireEvent.press(screen.getByTestId('lang-zh'))
    })
    expect(screen.getByTestId('sign-in-email').props.value).toBe('learner@example.com')
    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-request'))
    })
    await waitFor(() => expect(requestLink).toHaveBeenCalledTimes(1))
    expect(requestLink.mock.calls[0]?.[0]).toMatchObject({
      json: { email: 'learner@example.com', audience: 'learner', locale: 'zh' },
    })
  })
})
