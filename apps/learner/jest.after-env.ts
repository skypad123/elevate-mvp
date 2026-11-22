import { resetMockDeviceLanguages } from './src/test-utils/device-languages'

// Runs once the test framework is installed, so `afterEach` exists here (not in jest.setup.ts).
afterEach(() => {
  resetMockDeviceLanguages()
})
