// Jest runs the iOS platform resolution (jest-expo default), so the native
// preferences-storage.ts is under test. AsyncStorage is replaced by its official
// in-memory mock; tests seed it through the same API the app uses.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// A note on `testTimeout` in package.json (JSON has no comments): the first test that renders
// loads React Native, which takes 3 to 5 seconds on a cold CI runner. Jest's default limit of 5
// seconds made that test fail now and then, so the limit is 30 seconds for every test here.

// The phone's languages. English unless a test calls setMockDeviceLanguages from
// src/test-utils/device-languages; jest.after-env.ts puts it back after every test.
jest.mock('expo-localization', () => {
  const { mockLocales } = require('./src/test-utils/device-languages')
  return { getLocales: () => mockLocales(), useLocales: () => mockLocales() }
})

// The API client. Every call a test makes is a jest.fn; a test sets what it answers with
// `jsonResponse` from src/test-utils/api, or rejects with new Error('Network request failed') to
// be offline. A call nobody set up answers undefined, which the code under test treats as a failure.
jest.mock('@/lib/api', () => ({
  api: {
    me: {
      $patch: jest.fn(),
      classes: {
        $get: jest.fn(),
        blocks: { ':blockId': { $get: jest.fn(), 'check-in': { $post: jest.fn() } } },
        attendance: { ':eventId': { dispute: { $post: jest.fn() } } },
        ':enrollmentId': { withdraw: { $post: jest.fn() } },
      },
    },
    catalog: { courses: { ':slug': { $get: jest.fn() } } },
    checkout: {
      classes: { ':classId': { $get: jest.fn(), $post: jest.fn() } },
      sessions: { ':id': { sync: { $get: jest.fn() } } },
    },
    auth: {
      'magic-link': { $post: jest.fn() },
      verify: { $post: jest.fn() },
      me: { $get: jest.fn() },
      'sign-out': { $post: jest.fn() },
    },
  },
}))

// The session token, kept in memory instead of the keychain.
jest.mock('@/lib/token-storage', () => {
  let token: string | null = null
  return {
    tokenStorage: {
      get: async () => token,
      set: async (value: string) => {
        token = value
      },
      clear: async () => {
        token = null
      },
    },
  }
})

// Icons are drawings with no text; lucide-react-native ships ES modules Jest won't load, so every
// icon renders nothing in tests.
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
