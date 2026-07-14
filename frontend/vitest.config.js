import { defineConfig } from 'vitest/config';

// Separate from vite.config.js on purpose: tests only need plain Node + the
// on-device engine (sql.js runs fine under Node), not the PWA/React plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
