# Accessibility tests

ShopLite is checked against **WCAG 2.2 level AA** in three layers, because no single tool finds
everything. Automated scanners catch roughly a third of accessibility problems; the rest needs
tests that behave like a keyboard or screen reader user.

| Layer | Tool | Where | What it checks |
|-------|------|-------|----------------|
| Rule scan | axe-core 4.14 | `e2e/playwright/a11y/pages.a11y.spec.ts` | Every page and state: names, roles, labels, contrast, structure |
| Behaviour | Playwright | `e2e/playwright/a11y/keyboard.a11y.spec.ts` | Keyboard-only purchase, focus ring, skip link, live regions, titles, reflow |
| Second scan | Pa11y CI (HTML_CodeSniffer + axe) | `accessibility-tests/pa11yci.config.js` | Same pages with a different rule engine |
| Score | Lighthouse | `performance-tests/lighthouse/` | Accessibility score must be 100 on home, product and login |

All of them run in the CI job `accessibility` (Lighthouse in `performance-lighthouse`).

## Run

```bash
cd e2e/playwright && npm ci && npx playwright test --project=a11y
cd accessibility-tests && PUPPETEER_SKIP_DOWNLOAD=true npm ci && npm test   # uses your Google Chrome
```

## axe-core scans

Pages are scanned in the states a user actually sees, not just right after load: products loaded,
no search results, a sold-out product, the login form with an error, the cart with items and empty,
order history, and the product list at phone width. A failure lists each violation with its impact,
rule, the element and a help link.

## Keyboard and screen reader behaviour

- **Keyboard-only purchase:** log in, open a product, raise the quantity with the arrow key, add to
  cart, open the cart and place the order, using only Tab, arrows and Enter.
- **Skip link** is the first Tab stop, becomes visible, and moves focus to the main content.
- **Focus indicator:** tabs through every control on the product list and checks each one has a
  visible `:focus-visible` outline of at least 2 px.
- **Announcements:** errors appear in a `role="alert"` live region, so screen readers read them out.
- **Titles and headings:** every page has a unique `<page> | ShopLite` title and exactly one `h1`.
- **Reflow (WCAG 1.4.10):** no horizontal scrolling at 320 CSS px, which equals 400% zoom.

Checked by breaking the CSS on purpose: removing the focus outline in the filter bar fails, naming
the `search` input; keeping the skip link off-screen fails the skip-link test.

## Pa11y CI

Pa11y runs HTML_CodeSniffer, whose rules differ from axe-core, plus axe as a cross-check. Logged-in
pages are reached with Pa11y actions that fill in the real login form. Lightening the muted text
colour to `#b0b0aa` makes all 7 pages fail on contrast.

Two findings were checked and are ignored on the page where they occur only:

| Finding | Why it is a false positive |
|---------|----------------------------|
| axe `color-contrast` on the two dropdowns (home) | axe can't measure text over the dropdown's arrow background image and marks it "needs review". Measured: `#1d1d1b` on white is 16.9:1 (minimum 4.5:1), and HTML_CodeSniffer passes the same check. |
| HTML_CodeSniffer `H98` on `autocomplete="username"` (login) | The HTML spec allows `username` on `type="email"` inputs, password managers rely on it, and axe accepts it. |

## Found and fixed

- **Cart table** (axe `empty-table-header`): the Remove column's header used `.hidden`
  (`display: none`), so screen readers announced an empty header. A new `.visually-hidden` class
  keeps "Actions" readable for screen readers while staying invisible on screen.
