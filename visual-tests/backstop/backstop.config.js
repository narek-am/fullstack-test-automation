// BackstopJS configuration: every scenario is captured at three viewports and compared
// pixel by pixel with the approved reference images in backstop_data/bitmaps_reference.
const fs = require('node:fs');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3301';

// Use the installed Google Chrome (CHROME_PATH overrides). The Chromium build that comes with
// BackstopJS's Puppeteer is often missing or mismatched, and a known browser keeps screenshots stable.
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePath = process.env.CHROME_PATH || (fs.existsSync(MAC_CHROME) ? MAC_CHROME : undefined);
const customer = { email: 'alice@shoplite.test', password: 'Passw0rd!' };

const scenarios = [
  {
    label: 'Product list',
    url: `${BASE_URL}/`,
    readySelector: '[data-testid="product-card"]',
  },
  {
    label: 'Product list - search with no results',
    url: `${BASE_URL}/?search=nothing-matches-this`,
    waitForResultCount: true,
  },
  {
    label: 'Product list - hover on product link',
    url: `${BASE_URL}/`,
    readySelector: '[data-testid="product-card"]',
    hoverSelector: '[data-sku="MG-001"] [data-testid="product-link"]',
    selectors: ['[data-testid="product-list"]'],
    viewports: ['desktop'],
  },
  {
    label: 'Product details',
    url: `${BASE_URL}/product?id=5`,
    readySelector: '[data-testid="product-detail"]:not(.hidden)',
  },
  {
    label: 'Product details - sold out',
    url: `${BASE_URL}/product?id=6`,
    readySelector: '[data-testid="product-detail"]:not(.hidden)',
  },
  {
    label: 'Login',
    url: `${BASE_URL}/login`,
    readySelector: '[data-testid="login-form"]',
  },
  {
    label: 'Login - validation error',
    url: `${BASE_URL}/login`,
    readySelector: '[data-testid="login-form"]',
    clickSelector: '[data-testid="login-button"]',
    postInteractionWait: '[data-testid="message"].error',
  },
  {
    label: 'Login - keyboard focus on email',
    url: `${BASE_URL}/login`,
    readySelector: '[data-testid="login-form"]',
    keyPressSelectors: [{ selector: '[data-testid="email-input"]', keyPress: 'a' }],
    viewports: ['desktop'],
  },
  {
    label: 'Cart with items',
    url: `${BASE_URL}/cart`,
    loginAs: customer,
    cartItems: [
      { productId: 3, quantity: 2 },
      { productId: 1, quantity: 1 },
    ],
    readySelector: '[data-testid="cart-item"]',
  },
  {
    label: 'Cart empty',
    url: `${BASE_URL}/cart`,
    loginAs: { email: 'bob@shoplite.test', password: 'Passw0rd!' },
    cartItems: [],
    readySelector: '[data-testid="cart-empty"]:not(.hidden)',
  },
  {
    label: 'Page not found',
    url: `${BASE_URL}/no-such-page`,
    readySelector: 'h1',
  },
];

const viewports = [
  { label: 'phone', width: 375, height: 812 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1280, height: 900 },
];

module.exports = {
  id: 'shoplite',
  viewports,
  onBeforeScript: 'puppet/onBefore.js',
  onReadyScript: 'puppet/onReady.js',
  scenarios: scenarios.map((s) => ({
    delay: 0,
    misMatchThreshold: 0.1, // percent of pixels that may differ (anti-aliasing noise)
    requireSameDimensions: true,
    ...s,
    viewports: s.viewports ? viewports.filter((v) => s.viewports.includes(v.label)) : undefined,
  })),
  paths: {
    bitmaps_reference: 'backstop_data/bitmaps_reference',
    bitmaps_test: 'backstop_data/bitmaps_test',
    engine_scripts: 'engine_scripts',
    html_report: 'backstop_data/html_report',
    ci_report: 'backstop_data/ci_report',
  },
  report: process.env.CI ? ['CI'] : ['browser', 'CI'],
  openReport: false,
  engine: 'puppeteer',
  engineOptions: {
    headless: 'new',
    executablePath: chromePath,
    args: ['--no-sandbox', '--font-render-hinting=none', '--disable-gpu'],
  },
  // One capture at a time: the cart scenarios log in and change the same cart before each
  // screenshot, and parallel captures would overwrite each other (seen as wrong quantities).
  asyncCaptureLimit: 1,
  asyncCompareLimit: 20,
  debug: false,
  debugWindow: false,
};
