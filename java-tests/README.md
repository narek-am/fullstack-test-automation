# Java test suites

Maven project with the JVM-based test suites for ShopLite.

| Package | Tool | Tag |
|---------|------|-----|
| `com.shoplite.api` | REST Assured + JUnit 5 + AssertJ | `api` |
| `com.shoplite.karate` | Karate (BDD-style `.feature` files) | `karate` |

## How the app is started

`ShopLiteServer` starts the Node app once per test run on a free port with a fresh database,
waits for `/api/health`, and stops it when the JVM exits. To test an instance that is already
running, pass its URL instead:

```bash
./mvnw test -Dshoplite.baseUrl=http://localhost:3000
```

## Run

Requires JDK 21 and Node.js (with `npm install` done in `../app`).

```bash
./mvnw test                 # everything
./mvnw test -Dgroups=api    # only REST Assured tests
./mvnw test -Dgroups=karate # only Karate features
```

Reports: `target/surefire-reports/` and, for Karate, `target/karate-reports/karate-summary.html`.

## REST Assured highlights

- Shared `RequestSpecification` / `ResponseSpecification` (base URI, JSON, response-time limit)
- JSON Schema contract check (`src/test/resources/schemas/product-list.json`)
- Typed models with Java records (`api/model`) for request and response bodies
- Parameterized tests (`@CsvSource`, `@MethodSource`) for error cases and invalid bodies
- End-to-end API flow: cart → order → stock reduced → cart emptied
- Security checks: no account enumeration on login, token revoked on logout, IDOR protection

## Karate highlights

- `karate-config.js` reuses the same `ShopLiteServer` launcher through Java interop
- Fuzzy schema matching (`#number? _ > 0`, `#regex`, `#[6] schemas.product`) from a shared `schemas.json`
- `Scenario Outline` tables for negative cases (`body!` column = evaluated as JSON)
- Reusable `login.feature` called from other features; helper features tagged `@ignore`
- Features run in parallel; `orders.feature` is `@parallel=false` because its scenarios share one cart
