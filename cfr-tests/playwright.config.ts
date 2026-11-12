import { defineConfig, devices } from '@playwright/test';

// Chaos experiments start and break their own ShopLite processes (see support/shoplite.ts),
// so there is no webServer here. They run one at a time: each one owns its server.
export default defineConfig({
  testDir: './chaos',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0, // a chaos experiment that only passes on retry is a finding, not noise
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }], ...(process.env.GITHUB_ACTIONS ? [['github'] as const] : [])],
  use: {
    ...devices['Desktop Chrome'],
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
  },
});
