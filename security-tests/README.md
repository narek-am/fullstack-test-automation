# Security tests

Security checks for ShopLite, organised by the threats in [`docs/threat-model.md`](../docs/threat-model.md).

| Layer | Tool | What it checks |
|-------|------|----------------|
| API (in-process) | Jest + Supertest | Headers, authentication, access control, injection, input handling |
| Frontend source | Jest (static checks) | Dangerous DOM sinks, inline scripts and handlers |
| Dependencies | npm audit, OSV-Scanner | Known vulnerabilities in npm and Maven dependencies |

## Run

```bash
cd app && npm ci && cd ..
cd security-tests && npm ci && npm test
```

The tests start ShopLite in-process with an in-memory database, so nothing needs to be running.

## API tests (`api/`)

| File | Threats | Examples |
|------|---------|----------|
| `headers.security.test.js` | T8, T12, T14 | CSP, `X-Frame-Options`, `nosniff` on JSON, HTML, static files **and** error pages; no CORS for foreign origins |
| `authentication.security.test.js` | T1, T2, T7 | Same answer for unknown email and wrong password; rate limit with `Retry-After`; forged, expired and revoked tokens |
| `access-control.security.test.js` | T4, T6, T11 | Bob can't see Alice's order (404, same as a missing one); `userId` in the body is ignored; client prices are ignored |
| `injection.security.test.js` | T3, T12 | SQL payloads in every input, then a check that the data is unchanged; XSS payloads never reach HTML |
| `input-handling.security.test.js` | T8, T10 | 10 KB body limit; malformed JSON; type confusion; `__proto__` pollution; path traversal |

Every negative test is paired with a positive one where it matters (for example, the admin
**can** change stock), so a route that simply rejects everyone would not pass.

## Static checks (`static/`)

`frontend.security.test.js` reads `app/public` and fails on `innerHTML`, `eval`,
`document.write`, inline `<script>` blocks, `on…=` handlers and `javascript:` links.
The CSP would block most of these in the browser; the test catches them at commit time.

## Dependency scanning (CI job `security-dependencies`)

- `scripts/npm-audit-report.mjs` runs `npm audit` in every npm project and writes a table to the
  GitHub job summary. **Production dependencies must have zero known vulnerabilities**, otherwise
  the job fails. Findings in dev-only test tooling (Newman, BackstopJS, Cypress…) are listed as
  notices: that code never ships, and most fixes need major upgrades of those tools.
- [OSV-Scanner](https://google.github.io/osv-scanner/) scans npm lockfiles and `java-tests/pom.xml`
  (including transitive Maven dependencies) against the OSV database. It is report-only, because
  every Maven dependency in this repo is a test tool. The binary's SHA-256 is checked before use.

To check that the gate works, pin an old Express in `app` and run the script:

```bash
cd app && npm install --package-lock-only express@4.17.1 && cd ..
node security-tests/scripts/npm-audit-report.mjs   # exits 1: "4 high, 3 low" in production dependencies
git checkout app/package.json app/package-lock.json
```

## Bugs these tests found

Writing these tests found three real problems in ShopLite, all fixed in separate commits:

1. `?search=a&search=b` and `?category=a&category=b` crashed with **500**: Express turns repeated
   parameters into arrays, and SQLite can't bind an array.
2. `?sort=constructor` crashed with **500**: the allow-list lookup `SORTS[sort]` found an
   inherited object property, which then ended up in `ORDER BY`.
3. `/api/products/0x01` returned product 1: `Number()` accepts hex, exponent and padded strings.
   Now only plain decimal digits are accepted.
