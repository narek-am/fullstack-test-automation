# Cypress UI tests

A small Cypress suite that complements the Playwright tests in `../playwright` with a
different focus: **controlling the network** and **custom commands**.

## What it shows

| Technique | Where |
|-----------|-------|
| `cy.intercept` with a **fixture** to render data that isn't in the database | `network-stubbing.cy.js` |
| Stubbed **empty list**, **HTTP 500** and **network error** to test error states | `network-stubbing.cy.js` |
| **Delayed responses** (`res.setDelay`) to test slow APIs | `network-stubbing.cy.js` |
| **Spying** on real requests and asserting query params, headers and body | both specs |
| Stubbed **409 at checkout** and **401 token expiry** to test edge cases the real data can't easily produce | `cart-session.cy.js` |
| `cy.session` for a cached **API login**, with a `validate` step | `support/commands.js` |
| Custom commands: `byTestId`, `loginByApi`, `resetCart`, `addToCartFromProductPage` | `support/commands.js` |

## Run

```bash
npm install
npm test        # starts ShopLite with a fresh DB, runs Cypress headless in Chrome, stops the app
npm run cy:open # interactive runner (start the app first with: npm run start:app)
```
