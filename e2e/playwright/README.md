# Playwright end-to-end tests (TypeScript)

Browser tests for the ShopLite web UI, run in **Chromium, Firefox and WebKit**.

## Design

- **Page Object Model**: `pages/` holds one class per page plus a `BasePage` for the shared header.
  Tests talk to page objects, never to raw selectors.
- **User-facing locators**: `getByRole`, `getByLabel`, and `getByTestId` (`data-testid`) as a fallback.
- **Custom fixtures** (`support/fixtures.ts`): page objects are injected into tests, plus
  - `signIn(user)`: logs in through the API and stores the session, skipping the login UI
    for tests that are not about login (faster, less flaky)
  - `resetCart(user)`: empties a cart through the API so every test starts from a known state
- **Isolation**: each browser project gets its own ShopLite server and database
  (`scripts/start-app.mjs`), and specs that change a cart use different users.
- **Web-first assertions** with auto-waiting; no fixed sleeps.
- **Debugging on failure**: trace, screenshot and video are kept for failed tests.

## What is covered

| Spec | Scenarios |
|------|-----------|
| `products.spec.ts` | Listing, sold-out state, search, empty results, filter + sort, filters kept in the URL, XSS attempt in search, product page, unknown product, 404 page |
| `login.spec.ts` | Successful login, wrong password, empty fields, redirect after login, open-redirect protection, logout, protected pages |
| `cart.spec.ts` | Add to cart, totals and shipping, free-shipping threshold, change quantity, stock limit enforced by the form, remove item |
| `checkout.spec.ts` | Full journey with `test.step`: log in → search → add → place order → order history; stock reduced after an order |

## Run

```bash
npm install
npx playwright install --with-deps
npm test                  # all three browsers
npm run test:chromium     # one browser
npm run test:headed       # watch it run
npm run test:ui           # Playwright UI mode
npm run report            # open the HTML report
```
