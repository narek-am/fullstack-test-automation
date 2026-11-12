// Pa11y CI: a second, independent accessibility scan of every page.
// It runs two engines: HTML_CodeSniffer (different rules from axe-core, used by the Playwright
// suite) and axe itself, both against WCAG 2.x AA. Logged-in pages are reached with Pa11y
// "actions" that drive the real login form, so the scan also covers the states after an action.
const fs = require('node:fs');

const base = 'http://127.0.0.1:3501';
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Use the installed Google Chrome (CHROME_PATH overrides), like the BackstopJS suite.
const executablePath = process.env.CHROME_PATH || (fs.existsSync(MAC_CHROME) ? MAC_CHROME : undefined);

const logIn = [
  `navigate to ${base}/login`,
  'set field #email to bob@shoplite.test',
  'set field #password to Passw0rd!',
  'click element [data-testid="login-button"]',
  'wait for path to be /',
];

module.exports = {
  defaults: {
    standard: 'WCAG2AA',
    runners: ['htmlcs', 'axe'],
    timeout: 30000,
    wait: 300,
    chromeLaunchConfig: { executablePath, args: ['--no-sandbox'] },
    // Every page fills itself from the API, so wait for the content before scanning.
  },
  urls: [
    {
      url: `${base}/`,
      actions: ['wait for element [data-testid="product-card"] to be visible'],
      // axe can't measure contrast on the two dropdowns because of their arrow background image, and
      // marks them "needs review" (Pa11y reports that as an error). Measured: #1d1d1b on #ffffff is
      // 16.9:1 (minimum 4.5:1), and HTML_CodeSniffer checks the same contrast on this page and passes.
      ignore: ['color-contrast'],
    },
    { url: `${base}/product?id=1`, actions: ['wait for element [data-testid="product-detail"] to be visible'] },
    { url: `${base}/product?id=6`, actions: ['wait for element [data-testid="product-detail"] to be visible'] },
    `${base}/missing-page`,
    {
      url: `${base}/login`,
      // The form with an error message showing.
      // HTML_CodeSniffer says autocomplete="username" is invalid on type="email". The HTML spec allows
      // it (the Username autofill group includes the Email input type), password managers rely on it
      // for the login field, and axe's autocomplete-valid rule accepts it.
      ignore: ['WCAG2AA.Principle1.Guideline1_3.1_3_5.H98'],
      actions: [
        'set field #email to alice@shoplite.test',
        'set field #password to wrong-password',
        'click element [data-testid="login-button"]',
        'wait for element [data-testid="message"] to be visible',
      ],
    },
    {
      url: `${base}/login`,
      // Logged in as Bob, add an item, then scan the cart with it.
      actions: [
        ...logIn,
        `navigate to ${base}/product?id=3`,
        'wait for element [data-testid="add-to-cart"] to be visible',
        'click element [data-testid="add-to-cart"]',
        'wait for element [data-testid="message"] to be visible',
        `navigate to ${base}/cart`,
        'wait for element [data-testid="cart-contents"] to be visible',
      ],
    },
    {
      url: `${base}/login`,
      actions: [...logIn, `navigate to ${base}/orders`, 'wait for element h1 to be visible'],
    },
  ],
};
