# Full-Stack Test Automation

[![CI](https://github.com/narek-am/fullstack-test-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/narek-am/fullstack-test-automation/actions/workflows/ci.yml)

Test automation for every layer of one web application, from unit tests to chaos experiments,
all running in a 19-job CI pipeline.

The system under test is **ShopLite** ([`app/`](app/)), a small online shop built for this
repository. Every suite, including the load tests and security scans, runs against an application
I own, locally and in CI, without touching third-party sites.

**At a glance**

- **25+ tools** across 12 kinds of testing, in JavaScript/TypeScript and Java
- **19 parallel CI jobs** on Linux, macOS and an Android emulator, plus a matching `Jenkinsfile`
- **14 real problems found by the tests and fixed** in the app, each in its own commit ([list](#problems-the-tests-found))
- Suites were checked by **breaking the app on purpose**, to make sure they fail for the right reason

## What's inside

| Kind of testing | Tools | Where |
|-----------------|-------|-------|
| Unit & integration | Jest, Supertest | [`app/test`](app/test) |
| API (JavaScript) | Postman collections run with Newman, data-driven from CSV | [`api-tests/postman`](api-tests/postman) |
| API (Java) | REST Assured + JUnit 5 + AssertJ, JSON Schema; Karate | [`java-tests`](java-tests) |
| Contract | Pact (consumer tests and provider verification) | [`contract-tests`](contract-tests) |
| UI end-to-end | Playwright (TypeScript, page objects, 3 browsers); Cypress (network stubbing) | [`e2e/playwright`](e2e/playwright), [`e2e/cypress`](e2e/cypress) |
| Visual regression | BackstopJS (3 viewports); Playwright screenshots (components and states) | [`visual-tests/backstop`](visual-tests/backstop), [`e2e/playwright/visual`](e2e/playwright/visual) |
| Data | SQL data-quality checks, JDBC persistence tests, Kafka event tests with Testcontainers | [`data-tests`](data-tests), [`java-tests`](java-tests) |
| Security | Attack tests (Jest), static XSS checks, OWASP ZAP baseline, npm audit, OSV-Scanner, Talisman | [`security-tests`](security-tests) |
| Performance | Apache Bench, JMeter, Gatling, Lighthouse CI with budgets | [`performance-tests`](performance-tests) |
| Accessibility | axe-core, keyboard and screen-reader tests (Playwright), Pa11y CI, Lighthouse | [`accessibility-tests`](accessibility-tests), [`e2e/playwright/a11y`](e2e/playwright/a11y) |
| Chaos & architecture | Fault-injection experiments (Playwright), dependency-cruiser, ArchUnit | [`cfr-tests`](cfr-tests) |
| Mobile | Playwright phone emulation (Android, iPhone); Appium + WebdriverIO on an Android emulator | [`e2e/playwright/mobile`](e2e/playwright/mobile), [`mobile-tests`](mobile-tests) |

Each folder has its own README: what the suite covers, why it is built that way, how to run it,
and what it found.

Planning documents: [test strategy](docs/test-strategy.md), [exploratory testing charters](docs/exploratory-testing.md)
and a [STRIDE threat model](docs/threat-model.md) that the security tests are mapped to.

## Problems the tests found

Writing the suites turned up real defects in ShopLite. Each was fixed in its own commit, usually
together with a test that fails without the fix:

| Found by | Problem | Fix |
|----------|---------|-----|
| BackstopJS | The cart table overflowed the screen on phones | [`a2096d8`](https://github.com/narek-am/fullstack-test-automation/commit/a2096d8) |
| BackstopJS (macOS CI) | Native dropdowns looked different on each platform; now styled the same everywhere | [`dc98c3c`](https://github.com/narek-am/fullstack-test-automation/commit/dc98c3c) |
| Security tests | `?search=a&search=b` and `?sort=constructor` crashed product search with a 500 | [`f6bd96a`](https://github.com/narek-am/fullstack-test-automation/commit/f6bd96a) |
| Security tests | `/api/products/0x01` was accepted as product 1 (hex, exponent and padded numbers) | [`d33bc51`](https://github.com/narek-am/fullstack-test-automation/commit/d33bc51) |
| OWASP ZAP | Without JavaScript, the login form sent the password in the URL | [`1d0c9c2`](https://github.com/narek-am/fullstack-test-automation/commit/1d0c9c2) |
| OWASP ZAP | Missing `Cross-Origin-Embedder-Policy` header | [`f70c906`](https://github.com/narek-am/fullstack-test-automation/commit/f70c906) |
| Lighthouse | The footer jumped down while pages loaded (layout shift 0.072) | [`23e2e20`](https://github.com/narek-am/fullstack-test-automation/commit/23e2e20) |
| Lighthouse (Linux CI) | The scrollbar appearing shifted the whole page sideways (layout shift 0.121) | [`98a5e6b`](https://github.com/narek-am/fullstack-test-automation/commit/98a5e6b) |
| axe-core | Screen readers announced an empty column header in the cart | [`46e1343`](https://github.com/narek-am/fullstack-test-automation/commit/46e1343) |
| Chaos experiment | On a slow connection, a double click added the item to the cart twice | [`d319b4e`](https://github.com/narek-am/fullstack-test-automation/commit/d319b4e) |
| Chaos experiment | After a server restart, users saw a raw token error instead of the login page | [`b2f10f5`](https://github.com/narek-am/fullstack-test-automation/commit/b2f10f5) |
| dependency-cruiser | One API route imported code from another route | [`e023e30`](https://github.com/narek-am/fullstack-test-automation/commit/e023e30) |
| Phone emulation | Header links and product names were too small to tap (18–20 px; WCAG asks for 24) | [`636b986`](https://github.com/narek-am/fullstack-test-automation/commit/636b986) |
| Phone emulation | iPhones showed the full keyboard instead of the number pad for quantities | [`d45e35e`](https://github.com/narek-am/fullstack-test-automation/commit/d45e35e) |

## How the tests are built

- **One app, known data.** Every suite starts ShopLite on its own port with a throwaway SQLite
  database and fixed seed data, so suites run in parallel without sharing state.
- **Tests that fail for the right reason.** New suites were checked by breaking the app on
  purpose: hiding the focus ring, adding 200 ms of latency, padding the CSS by 20 KB, adding a
  forbidden import, pinning a vulnerable dependency. A test that can't fail proves nothing.
- **Limits from measurements.** Screenshot tolerances, performance budgets and load-test limits
  are based on measured values, written next to the setting, rather than raised until CI passes.
- **False positives are investigated, not muted.** When Pa11y or Talisman flagged something, it
  was measured or checked against the spec first, then ignored only where it applies, with the
  reason in the config.
- **Failures are readable on the CI page.** BackstopJS, Playwright, npm audit, Talisman, ZAP,
  Lighthouse and Appium results become GitHub annotations and job summaries, so the cause of a red
  build is visible without downloading logs.

## CI pipeline

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs 19 jobs in parallel on every push:

| Group | Jobs |
|-------|------|
| Fast feedback | Unit & integration · API (Newman) · API, data & architecture (REST Assured, Karate, JDBC, ArchUnit) · Contract (Pact) |
| Data | SQL data quality · Kafka events (Testcontainers) |
| UI | Playwright (3 browsers + 2 phones) · Cypress · Mobile (Appium on an Android 14 emulator) |
| Visual | BackstopJS · Playwright screenshots (both on macOS, where the baselines were made) |
| Security | API attack tests · Dependency scan · Secret scan (whole history) · OWASP ZAP baseline |
| Performance | Apache Bench, JMeter and Gatling · Lighthouse budgets |
| Quality attributes | Accessibility (axe-core, keyboard, Pa11y) · Chaos & architecture |

A [`Jenkinsfile`](Jenkinsfile) describes the same stages for teams on Jenkins. It follows the same
structure but has not been run on a live Jenkins server.

## Run it locally

Requirements: Node.js 24 (see `.nvmrc`). Some suites also need Java 21, Google Chrome, Docker
(Kafka tests) or an Android emulator (Appium).

```bash
cd app && npm ci && npm start        # ShopLite on http://localhost:3000
```

```bash
cd app && npm test                   # unit and integration tests
```

```bash
cd e2e/playwright && npm ci && npx playwright install && npm test
```

Every other suite runs the same way from its folder; the exact commands are in each README.
Test suites start their own copy of the app, so nothing else needs to be running.

## About this project

The range of testing approaches follows *Full Stack Testing* by Gayathri Mohan (O'Reilly), which
covers testing at every layer of an application. ShopLite and all the test code here are my own.
