import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // CJS test files can't `require('vitest')` itself; globals avoids that.
    globals: true,
    // Each test file gets its own module registry, which is what gives every
    // file a fresh, isolated temp SQLite database (see test/testApp.js).
    fileParallelism: true,
  },
});
