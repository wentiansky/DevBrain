import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 90000,
  globalSetup: process.env.E2E_SKIP_SETUP
    ? undefined
    : './e2e/global.setup.mts',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    proxy: process.env.HTTP_PROXY
      ? {
          server: process.env.HTTP_PROXY,
          bypass: 'localhost,127.0.0.1,*.local',
        }
      : undefined,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        cwd: '../..',
        env: {
          ...process.env,
          NO_PROXY: 'localhost,127.0.0.1',
          no_proxy: 'localhost,127.0.0.1',
        },
      },
});