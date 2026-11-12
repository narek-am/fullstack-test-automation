// WebdriverIO + Appium: ShopLite in the real Chrome browser of an Android emulator.
// Playwright's phone projects (e2e/playwright/mobile) emulate a phone inside desktop browser
// engines; this suite drives the actual mobile browser, its on-screen keyboard and rotation.
//
// Needs: a running Android emulator (adb devices), and ShopLite on the host:
//   npm run start:app   # then, in another terminal:  npm test
// The emulator reaches the host as 10.0.2.2.

exports.config = {
  runner: 'local',
  specs: ['./test/**/*.e2e.js'],
  maxInstances: 1,

  capabilities: [
    {
      platformName: 'Android',
      browserName: 'Chrome',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android Emulator',
      // Download the chromedriver that matches the emulator's Chrome (allowed in services below).
      'appium:chromedriverAutodownload': true,
      'appium:newCommandTimeout': 300,
      'appium:uiautomator2ServerInstallTimeout': 120000,
      'appium:adbExecTimeout': 120000,
      'goog:chromeOptions': { args: ['--disable-fre', '--no-first-run', '--no-default-browser-check'] },
    },
  ],

  baseUrl: process.env.BASE_URL || 'http://10.0.2.2:3701',
  waitforTimeout: 20000,
  connectionRetryTimeout: 240000,
  connectionRetryCount: 2,

  // Starts the Appium server installed in this project (appium + the uiautomator2 driver).
  services: [
    [
      'appium',
      {
        args: { allowInsecure: 'uiautomator2:chromedriver_autodownload', logFile: './appium.log' },
      },
    ],
  ],

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 180000 },
};
