import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'app.spec.ts',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 960 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.CI ? undefined : 'msedge',
      },
    },
  ],
  webServer: {
    command: 'npx vite --port 5173 --host localhost',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
