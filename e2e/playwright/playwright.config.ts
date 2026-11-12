import { defineConfig, devices } from '@playwright/test';

// Each browser project gets its own ShopLite instance and database, so projects can run
// in parallel without sharing carts or stock.
const browsers = [
  { name: 'chromium', port: 3101, use: devices['Desktop Chrome'] },
  { name: 'firefox', port: 3102, use: devices['Desktop Firefox'] },
  { name: 'webkit', port: 3103, use: devices['Desktop Safari'] },
];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: browsers.map(({ name, port, use }) => ({
    name,
    use: { ...use, baseURL: `http://127.0.0.1:${port}` },
  })),
  webServer: browsers.map(({ port }) => ({
    command: `node scripts/start-app.mjs ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    stdout: 'ignore',
    stderr: 'pipe',
  })),
});
