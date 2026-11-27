import { defineConfig } from 'vitest/config'

// A test that builds a PGlite database runs every migration first, which takes more than vitest's
// default 10 seconds on a busy CI runner; the API's tests allow the same 30.
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
