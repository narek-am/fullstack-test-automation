# ShopLite Test Strategy

## 1. Context

ShopLite is a small online shop: a REST API (Express + SQLite) and a vanilla-JS web frontend.
Customers browse products, log in, manage a cart and place orders. Admins can change stock.
An `order.created` domain event is published for every order (optionally to Kafka).

The goal of this strategy is fast, trustworthy feedback on every change, with each risk
covered at the **lowest layer that can catch it**.

## 2. Quality goals and main risks

| Area | What could go wrong | Impact |
|------|---------------------|--------|
| Money | Wrong totals, shipping or rounding | Lost revenue, refunds |
| Stock | Overselling, stock going negative, partial orders | Unhappy customers |
| Security | Broken access control (seeing another user's orders), injection, brute-force login | Data breach |
| Availability | Slow pages under load, dependency failures | Lost sales |
| Usability | Shop unusable with keyboard or screen reader, broken on mobile | Excluded users, legal risk |
| UI | Layout regressions after CSS changes | Lower conversion |

## 3. Test layers

Most checks live near the bottom of the pyramid, where they are fast and precise.
Fewer, broader tests sit at the top and confirm that the pieces work together.

```
                 ▲   Exploratory testing (humans, charters)
                ▲▲▲  UI end-to-end: Selenium, Cypress, Playwright, Appium
              ▲▲▲▲▲▲ Visual / a11y / performance checks on key pages
            ▲▲▲▲▲▲▲▲ Service tests: REST Assured, Karate, Postman, Pact contracts
          ▲▲▲▲▲▲▲▲▲▲ Integration tests: Supertest against the real app + DB
        ▲▲▲▲▲▲▲▲▲▲▲▲ Unit tests: Jest
```

| Layer | Tools | Folder | Runs |
|-------|-------|--------|------|
| Unit | Jest | `app/test/unit` | Every commit |
| Integration | Jest + Supertest | `app/test/integration` | Every commit |
| API / service | Postman + Newman, REST Assured, Karate | `api-tests/`, `java-tests/` | Every commit |
| Contract | Pact | `contract-tests/` | Every commit |
| UI end-to-end | Selenium WebDriver, Cypress, Playwright | `java-tests/`, `e2e/` | Every commit (smoke), nightly (full) |
| Data | SQL checks, JDBC, Kafka | `data-tests/`, `java-tests/` | Every commit / nightly |
| Visual | BackstopJS, Playwright screenshots | `visual-tests/`, `e2e/playwright` | Every PR |
| Security | Custom tests, OWASP ZAP, Dependency-Check, Talisman | `security-tests/` | Every PR + nightly |
| Performance | JMeter, Gatling, Apache Bench, autocannon, Lighthouse | `performance-tests/` | Nightly / before release |
| Accessibility | axe-core, Pa11y CI, Lighthouse | `accessibility-tests/` | Every PR |
| Cross-functional | Chaos experiments, architecture rules | `cfr-tests/` | Nightly |
| Mobile | Playwright device emulation, Appium | `e2e/playwright`, `mobile-tests/` | Nightly |
| Exploratory | Charters, session notes | `docs/exploratory-testing.md` | Each new feature |

## 4. Test data and environments

- The app seeds a fixed data set (`app/src/seed.js`), so tests can use known users and products.
- Unit/integration tests use an **in-memory database per test**, so they never share state.
- Browser and API suites start the app with a **fresh database file** for each run.
- Load tests and security scans only run against **our own local or CI instance**, never
  against third-party sites.

## 5. Entry and exit criteria

A change can be merged when:

- All unit, integration, API, contract and smoke UI tests pass.
- No new high/critical findings from dependency scanning or ZAP baseline.
- No new serious/critical axe violations on the main pages.
- Visual diffs are reviewed and either fixed or approved as new baselines.

Before a release, additionally:

- Load test meets targets: p95 < 300 ms for product listing at 50 virtual users, error rate < 1%.
- Lighthouse performance score ≥ 90 and accessibility score ≥ 95 on the product list page.

## 6. Defect handling

Each bug fix comes with a test that fails before the fix and passes after it, at the lowest
layer that reproduces the bug. Flaky tests are quarantined and fixed, not retried forever.

## 7. Metrics we watch

- Pipeline duration and pass rate (flakiness)
- Escaped defects per release
- The four key delivery metrics: deployment frequency, lead time for changes,
  change failure rate and time to restore service
