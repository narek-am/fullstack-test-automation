// Lighthouse CI: front-end performance of the pages a shopper sees first.
// Each page is loaded 3 times and the median run is checked, which smooths out noise.
// Lighthouse 12 removed budget.json, so the performance budgets are written as assertions on
// resource-summary (bytes and request counts per resource type) next to the timing metrics.
const port = 3410;
const base = `http://127.0.0.1:${port}`;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `node scripts/start-app.mjs ${port}`,
      startServerReadyPattern: 'ShopLite running',
      url: [`${base}/`, `${base}/product?id=1`, `${base}/login`],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--headless=new --no-sandbox',
        // No PWA or SEO checks: this is a performance gate. Accessibility has its own suite.
        onlyCategories: ['performance', 'best-practices'],
      },
    },
    assert: {
      aggregationMethod: 'median-run',
      assertions: {
        // Overall scores
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],

        // Core Web Vitals and loading metrics (desktop, simulated throttling)
        'first-contentful-paint': ['error', { maxNumericValue: 1000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'total-blocking-time': ['error', { maxNumericValue: 100 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
        'speed-index': ['error', { maxNumericValue: 1500 }],

        // Performance budgets: what a page may download
        'resource-summary:total:size': ['error', { maxNumericValue: 60_000 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 20_000 }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 15_000 }],
        'resource-summary:image:size': ['error', { maxNumericValue: 30_000 }],
        'resource-summary:third-party:count': ['error', { maxNumericValue: 0 }],
        'resource-summary:total:count': ['error', { maxNumericValue: 20 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse/results',
    },
  },
};
