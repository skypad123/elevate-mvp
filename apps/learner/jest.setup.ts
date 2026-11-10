// Jest runs the iOS platform resolution (jest-expo default), so the native
// preferences-storage.ts is under test. AsyncStorage is replaced by its official
// in-memory mock; tests seed it through the same API the app uses.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
