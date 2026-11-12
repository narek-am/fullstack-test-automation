import { defineConfig, devices } from '@playwright/test';

// Each project gets its own ShopLite instance and database, so projects can run
// in parallel without sharing carts or stock.
const functional = [
  { name: 'chromium', port: 3101, use: devices['Desktop Chrome'] },
  { name: 'firefox', port: 3102, use: devices['Desktop Firefox'] },
  { name: 'webkit', port: 3103, use: devices['Desktop Safari'] },
];

// Screenshot comparison runs in Chromium only. Baselines are stored per platform
// (…-darwin.png), so this project runs on macOS in CI as well.
const VISUAL_PORT = 3104;
// Accessibility checks (axe-core and keyboard tests) run in Chromium on their own instance.
const A11Y_PORT = 3105;
// Phone emulation: an Android phone in Chromium and an iPhone in WebKit, each with its own app.
const mobile = [
  { name: 'mobile-android', port: 3106, use: devices['Pixel 7'] },
  { name: 'mobile-ios', port: 3107, use: devices['iPhone 14'] },
];

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Per-pixel colour tolerance only; the number of differing pixels must be zero.
      threshold: 0.2,
    },
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{-projectName}{-platform}{ext}',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    // On GitHub Actions, failures also become annotations on the run summary page.
    ...(process.env.GITHUB_ACTIONS ? [['github'] as const] : []),
  ],
  use: {
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    ...functional.map(({ name, port, use }) => ({
      name,
      testDir: './tests',
      use: { ...use, baseURL: `http://127.0.0.1:${port}` },
    })),
    {
      name: 'visual',
      testDir: './visual',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${VISUAL_PORT}`,
        viewport: { width: 1280, height: 900 },
        // ShopLite's CSP blocks inline styles, including visual/screenshot.css injected by the tests.
        // Only this screenshot project bypasses it; the functional projects keep the real CSP.
        bypassCSP: true,
      },
    },
    {
      name: 'a11y',
      testDir: './a11y',
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${A11Y_PORT}` },
    },
    ...mobile.map(({ name, port, use }) => ({
      name,
      testDir: './mobile',
      use: { ...use, baseURL: `http://127.0.0.1:${port}` },
    })),
  ],
  webServer: [...functional.map(({ port }) => port), VISUAL_PORT, A11Y_PORT, ...mobile.map(({ port }) => port)].map((port) => ({
    command: `node scripts/start-app.mjs ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    stdout: 'ignore',
    stderr: 'pipe',
  })),
});
