import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Linking } from 'react-native'
import TeachScreen from '@/app/teach'
import { api } from '@/lib/api'
import { tokenStorage } from '@/lib/token-storage'
import { jsonResponse } from '@/test-utils/api'
import { setMockDeviceLanguages } from '@/test-utils/device-languages'
import { TestProviders } from '@/test-utils/providers'

const getMe = api.auth.me.$get as unknown as jest.Mock
const saved = process.env.EXPO_PUBLIC_TEACH_URL
let openURL: jest.SpyInstance

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  await tokenStorage.clear()
  getMe.mockResolvedValue(jsonResponse({ error: { code: 'unauthorized', message: '' } }, 401))
  process.env.EXPO_PUBLIC_TEACH_URL = 'https://teach.example.com'
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
})

afterEach(() => {
  openURL.mockRestore()
  if (saved === undefined) delete process.env.EXPO_PUBLIC_TEACH_URL
  else process.env.EXPO_PUBLIC_TEACH_URL = saved
})

const renderTeach = () =>
  renderRouter(
    { teach: TeachScreen, index: () => null },
    { initialUrl: '/teach', wrapper: TestProviders },
  )

describe('the /teach screen', () => {
  it('opens Teach in the phone’s browser, in the language the app is showing', async () => {
    setMockDeviceLanguages(['zh-SG'])
    await renderTeach()
    expect(await screen.findByText('在 Elevate 上授课')).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByTestId('teach-open'))
    })
    await waitFor(() => expect(openURL).toHaveBeenCalledTimes(1))
    expect(openURL).toHaveBeenCalledWith('https://teach.example.com/?lang=zh')
  })

  it('sends English when the app is in English', async () => {
    await renderTeach()
    expect(await screen.findByText('Teach on Elevate')).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByTestId('teach-open'))
    })
    expect(openURL).toHaveBeenCalledWith('https://teach.example.com/?lang=en')
  })
})
