// Jest runs the iOS platform resolution (jest-expo default), so the native
// preferences-storage.ts is under test. AsyncStorage is replaced by its official
// in-memory mock; tests seed it through the same API the app uses.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// A note on `testTimeout` in package.json (JSON has no comments): the first test that renders
// loads React Native, which takes 3 to 5 seconds on a cold CI runner. Jest's default limit of 5
// seconds made that test fail now and then, so the limit is 30 seconds for every test here.
