import { defineConfig } from 'vitest/config';

// These credentials are test-only and never used by the app or demo seed.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'queuesaathi-test-secret-never-use-in-deployment-2026';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SAME_SITE = 'lax';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
