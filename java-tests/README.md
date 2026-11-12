# Java test suites

Maven project with the JVM-based test suites for ShopLite.

| Package | Tool | Tag |
|---------|------|-----|
| `com.shoplite.api` | REST Assured + JUnit 5 + AssertJ | `api` |

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
```

Reports: `target/surefire-reports/`.

## REST Assured highlights

- Shared `RequestSpecification` / `ResponseSpecification` (base URI, JSON, response-time limit)
- JSON Schema contract check (`src/test/resources/schemas/product-list.json`)
- Typed models with Java records (`api/model`) for request and response bodies
- Parameterized tests (`@CsvSource`, `@MethodSource`) for error cases and invalid bodies
- End-to-end API flow: cart → order → stock reduced → cart emptied
- Security checks: no account enumeration on login, token revoked on logout, IDOR protection
