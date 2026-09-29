import { defineConfig } from 'vitest/config'

// Node-based unit tests for pure logic and the Dexie data layer (fake-indexeddb).
// The app itself is exercised in a browser by the qa subagents.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    globals: true
  }
})
