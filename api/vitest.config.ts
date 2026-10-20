import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts', 'test/**/*.spec.ts'],
    fileParallelism: false,
    setupFiles: ['dotenv/config'],
    env: { DATABASE_URL: 'file:./test.db', JWT_SECRET: 'test-secret', TZ: 'Europe/Paris' },
    globalSetup: ['test/global-setup.ts'],
  },
});
