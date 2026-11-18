// Jest runs as iOS, so these cover teachUrl()'s native branch; the web branch is checked by hand.
let mockHostUri: string | undefined
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockHostUri === undefined ? {} : { hostUri: mockHostUri }
    },
  },
}))

import { teachUrl } from '@/lib/web-url'

const saved = process.env.EXPO_PUBLIC_TEACH_URL

afterEach(() => {
  mockHostUri = undefined
  if (saved === undefined) delete process.env.EXPO_PUBLIC_TEACH_URL
  else process.env.EXPO_PUBLIC_TEACH_URL = saved
})

describe('teachUrl', () => {
  it('uses the configured address without its trailing slash', () => {
    process.env.EXPO_PUBLIC_TEACH_URL = 'https://teach.example.com/'
    expect(teachUrl()).toBe('https://teach.example.com')
    expect(teachUrl('/')).toBe('https://teach.example.com/')
  })

  it.each([
    ['missing', undefined],
    ['localhost', 'http://localhost:5173'],
    ['127.0.0.1', 'http://127.0.0.1:5173/'],
  ])('points at the development host when the address is %s', (_, value) => {
    if (value === undefined) delete process.env.EXPO_PUBLIC_TEACH_URL
    else process.env.EXPO_PUBLIC_TEACH_URL = value
    mockHostUri = '192.0.2.10:8081'
    expect(teachUrl('/')).toBe('http://192.0.2.10:5173/')
  })

  it('falls back to localhost when there is no development host', () => {
    delete process.env.EXPO_PUBLIC_TEACH_URL
    expect(teachUrl('/')).toBe('http://localhost:5173/')
  })
})
