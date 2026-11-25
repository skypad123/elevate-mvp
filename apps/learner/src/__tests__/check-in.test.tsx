import type { CheckInContext } from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter, screen as routerScreen } from 'expo-router/testing-library'
import { Platform, Text } from 'react-native'
import CheckInScreen from '@/app/class/check-in/[blockId]'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { tokenStorage } from '@/lib/token-storage'
import { jsonResponse } from '@/test-utils/api'
import { TestProviders } from '@/test-utils/providers'

const getMe = api.auth.me.$get as unknown as jest.Mock
const getClasses = api.me.classes.$get as unknown as jest.Mock
const getContext = api.me.classes.blocks[':blockId'].$get as unknown as jest.Mock
const postCheckIn = api.me.classes.blocks[':blockId']['check-in'].$post as unknown as jest.Mock

const BLOCK_ID = '7a1f2c3e-0000-4000-8000-000000000001'
const LINK_CODE = 'ABCDEFGHJKMNPQRSTVWX'

const context: CheckInContext = {
  blockId: BLOCK_ID,
  enrollmentId: '7a1f2c3e-0000-4000-8000-000000000002',
  className: 'March weekend class',
  startsAt: '2026-12-05T01:00:00.000Z',
  endsAt: '2026-12-05T04:00:00.000Z',
  timeZone: 'Asia/Singapore',
  asksLocation: true,
  checkInOpensAt: '2026-12-05T00:30:00.000Z',
  checkInClosesAt: '2026-12-05T04:30:00.000Z',
  state: 'not_arrived',
}

const user = {
  id: 'u1',
  email: 'learner@example.com',
  name: 'Ada Learner',
  avatarUrl: null,
  roles: [],
  profiles: [],
  locale: 'en',
  localeChosen: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const refusal = (status: number, code: string, details?: Record<string, unknown>) =>
  jsonResponse({ error: { code, message: 'English from the API', details } }, status)

async function signIn() {
  await tokenStorage.set('token')
  getMe.mockResolvedValue(jsonResponse({ user }))
}

const renderCheckIn = (address: string) =>
  renderRouter(
    {
      'class/check-in/[blockId]': CheckInScreen,
      'sign-in': () => <Text>Sign in</Text>,
      index: () => null,
    },
    { initialUrl: address, wrapper: TestProviders },
  )

/** The JSON body of the n-th check-in request. */
const sent = (n = 0): Record<string, unknown> => {
  const [request] = postCheckIn.mock.calls[n] ?? []
  return (request as { json: Record<string, unknown> }).json
}

beforeEach(async () => {
  jest.clearAllMocks()
  queryClient.clear()
  await AsyncStorage.clear()
  await tokenStorage.clear()
  getMe.mockResolvedValue(jsonResponse({ error: { code: 'unauthorized', message: '' } }, 401))
  getClasses.mockResolvedValue(jsonResponse({ items: [] }))
  getContext.mockResolvedValue(jsonResponse({ context }))
  postCheckIn.mockResolvedValue(
    jsonResponse({
      result: { state: 'present', flagReason: null, checkedInAt: '2026-12-05T00:50:00.000Z' },
    }),
  )
})

describe('the check-in screen, signed in', () => {
  it('fills in the code from the address and sends it as the QR link’s', async () => {
    await signIn()
    await renderCheckIn(`/class/check-in/${BLOCK_ID}?c=${LINK_CODE.toLowerCase()}`)
    const field = await screen.findByTestId('check-in-code')
    expect(field.props.value).toBe(LINK_CODE)
    expect(screen.getByText('The code from the link is filled in.')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('check-in-submit'))
    await waitFor(() => expect(postCheckIn).toHaveBeenCalledTimes(1))
    expect(postCheckIn.mock.calls[0]?.[0]).toMatchObject({ param: { blockId: BLOCK_ID } })
    expect(sent()).toMatchObject({ code: LINK_CODE, method: 'qr_link' })
    expect(await screen.findByText('You are checked in')).toBeTruthy()
  })

  it('normalises a typed code and sends it as typed', async () => {
    await signIn()
    await renderCheckIn(`/class/check-in/${BLOCK_ID}`)
    const field = await screen.findByTestId('check-in-code')
    expect(field.props.value).toBe('')
    await fireEvent.changeText(field, 'ab-c 2d9')
    expect(screen.getByTestId('check-in-code').props.value).toBe('ABC2D9')
    await fireEvent.press(screen.getByTestId('check-in-submit'))
    await waitFor(() => expect(postCheckIn).toHaveBeenCalledTimes(1))
    expect(sent()).toMatchObject({ code: 'ABC2D9', method: 'typed_code' })
  })

  it('sends `unsupported` from the app, without asking for location', async () => {
    await signIn()
    await renderCheckIn(`/class/check-in/${BLOCK_ID}`)
    await fireEvent.changeText(await screen.findByTestId('check-in-code'), 'ABC2D9')
    expect(screen.queryByText('Why Elevate asks for your location')).toBeNull()
    await fireEvent.press(screen.getByTestId('check-in-submit'))
    await waitFor(() => expect(postCheckIn).toHaveBeenCalledTimes(1))
    expect(sent()).toMatchObject({ platform: 'ios', location: { status: 'unsupported' } })
  })

  it('says so when the learner is already checked in', async () => {
    await signIn()
    getContext.mockResolvedValue(jsonResponse({ context: { ...context, state: 'present' } }))
    await renderCheckIn(`/class/check-in/${BLOCK_ID}`)
    expect(await screen.findByText('You are already checked in')).toBeTruthy()
    expect(screen.queryByTestId('check-in-code')).toBeNull()
  })

  it.each([
    [
      'a wrong code, with the tries left',
      refusal(422, 'check_in_code_wrong', { attemptsLeft: 3 }),
      /^That code is not right\. Type the code showing now\. You have 3 tries left\.$/,
      true,
    ],
    [
      'an expired code, with one try left',
      refusal(422, 'check_in_code_expired', { attemptsLeft: 1 }),
      /^That code has expired\. Type the code showing now\. You have 1 try left\.$/,
      true,
    ],
    [
      'an expired code, with no tries left',
      refusal(422, 'check_in_code_expired', { attemptsLeft: 0 }),
      /^That code has expired\. That was your last try for now/,
      true,
    ],
    [
      'a lockout, with when it ends',
      refusal(429, 'check_in_locked', { lockedUntil: '2026-12-05T01:05:00.000Z' }),
      /^Too many wrong codes\. Try again after .*9:05.*\.$/,
      false,
    ],
    [
      'a session not open yet',
      refusal(409, 'check_in_not_open', { opensAt: '2026-12-05T00:30:00.000Z' }),
      /^Check-in for this session opens at .*8:30.*\.$/,
      false,
    ],
    [
      'a session whose check-in has closed',
      refusal(409, 'check_in_closed', { closesAt: '2026-12-05T04:30:00.000Z' }),
      /^Check-in for this session closed at .*12:30.*\.$/,
      false,
    ],
    [
      'an overturned check-in',
      refusal(409, 'check_in_overturned'),
      /^Your check-in for this class was overturned\. Speak to your instructor\.$/,
      false,
    ],
  ])('words %s in the app’s language', async (_, answer, message, clears) => {
    await signIn()
    postCheckIn.mockResolvedValue(answer)
    await renderCheckIn(`/class/check-in/${BLOCK_ID}`)
    await fireEvent.changeText(await screen.findByTestId('check-in-code'), 'ABC2D9')
    await fireEvent.press(screen.getByTestId('check-in-submit'))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.queryByText('English from the API')).toBeNull()
    expect(screen.getByTestId('check-in-code').props.value).toBe(clears ? '' : 'ABC2D9')
  })
})

describe('the check-in screen, signed out', () => {
  it('in the app, goes to sign-in and comes back to this session without the link’s code', async () => {
    await renderCheckIn(`/class/check-in/${BLOCK_ID}?c=${LINK_CODE}`)
    await waitFor(() => expect(routerScreen).toHavePathname('/sign-in'))
    expect(routerScreen).toHaveSearchParams({ redirect: `/class/check-in/${BLOCK_ID}` })
    expect(getContext).not.toHaveBeenCalled()
  })

  describe('in a browser', () => {
    // Jest runs as iOS. Only the platform is switched back afterwards: restoreAllMocks would
    // also wipe the AsyncStorage mock's implementation.
    let os: { restore: () => void }
    beforeEach(() => {
      os = jest.replaceProperty(Platform, 'OS', 'web')
    })
    afterEach(() => os.restore())

    it('offers the app and sign-in, and sign-in comes back to this session', async () => {
      await renderCheckIn(`/class/check-in/${BLOCK_ID}?c=${LINK_CODE}`)
      expect(await screen.findByText('Open the Elevate app and type the code')).toBeTruthy()
      expect(screen.getByText('Sign in here')).toBeTruthy()
      expect(getContext).not.toHaveBeenCalled()
      await fireEvent.press(screen.getByTestId('check-in-sign-in'))
      await waitFor(() => expect(routerScreen).toHavePathname('/sign-in'))
      expect(routerScreen).toHaveSearchParams({ redirect: `/class/check-in/${BLOCK_ID}` })
    })
  })
})
