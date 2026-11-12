# Security tests

Security checks for ShopLite, organised by the threats in [`docs/threat-model.md`](../docs/threat-model.md).

| Layer | Tool | What it checks |
|-------|------|----------------|
| API (in-process) | Jest + Supertest | Headers, authentication, access control, injection, input handling |
| Frontend source | Jest (static checks) | Dangerous DOM sinks, inline scripts and handlers |
| Dependencies | npm audit, OSV-Scanner | Known vulnerabilities in npm and Maven dependencies |
| Secrets | Talisman | Keys, tokens and other secrets in commits |
| Running app (black box) | OWASP ZAP baseline | Passive scan of every page and response |

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

## Secret scanning (Talisman)

[Talisman](https://github.com/thoughtworks/talisman) looks for secrets before they reach git:
private key files, tokens, high-entropy strings and the extra patterns in
[`.talismanrc`](../.talismanrc) (AWS keys, GitHub tokens, live Stripe keys).

- **Before a commit:** install Talisman, then run `security-tests/scripts/install-talisman-hook.sh`
  to add a `pre-commit` hook.
- **In CI** (job `security-secrets`): `talisman --scan` checks every commit in the history.

The demo accounts' passwords are allowed explicitly in `.talismanrc`: they are seeded test data,
documented on purpose so the suites can log in.

The first history scan failed on low-severity name heuristics only: `passwords.test.js`, the
`*.sql` data checks and lines like `it('verifies the right password…')`. Instead of ignoring those
files (which would also hide a real key added to them later), `.talismanrc` sets
`threshold: medium`. Low-severity matches are reported as warnings; keys, tokens, private key
files, high-entropy strings and the custom patterns stay high severity and fail the build.
`.env` files are raised to high, because a committed `.env` usually holds real secrets.

## OWASP ZAP baseline scan (CI job `security-zap`)

CI starts ShopLite and runs the [ZAP baseline scan](https://www.zaproxy.org/docs/docker/baseline-scan/)
against it in Docker. The scan is **passive**: ZAP crawls the site (including links that only
exist after JavaScript runs) and inspects every response, but sends no attacks, so it is safe
to run on every push. The HTML report is uploaded as an artifact and the findings appear in the
job summary.

[`zap/rules.tsv`](zap/rules.tsv) decides what each finding means:

- **FAIL** for protections ShopLite already has (CSP, anti-clickjacking, `nosniff`,
  Permissions-Policy, no CORS, no version banners, no dangerous JS functions). A finding here is a
  regression, so the build fails.
- **IGNORE** for rules that don't apply, each with a reason:
  - *10035 Strict-Transport-Security*: the scan runs over plain HTTP on localhost; HSTS belongs to
    the TLS-terminating proxy in a real deployment.
  - *10202 Absence of Anti-CSRF Tokens*: ShopLite authenticates with a bearer token in the
    `Authorization` header, not cookies, so a cross-site form post carries no credentials.
  - *10109 Modern Web Application*, *10111 Authentication Request Identified* and
    *10049 Storable and Cacheable Content*: informational only, no risk on their own.
- Everything else is reported as a **warning** to review.

### Triage of the first scan

| ZAP alert | Decision |
|-----------|----------|
| 10024 Sensitive Information in URL: `/login?email=…&password=…` | **Real bug, fixed.** The login form had no `method`, so without JavaScript it submitted as GET. Now `method="post"`, a static test guards it, and the rule is FAIL. |
| 90004 Cross-Origin-Embedder-Policy missing (Low) | **Fixed.** Added `COEP: require-corp`; the rule is now FAIL. |
| 10031 User Controllable HTML Element Attribute | Kept as a warning. The search box is filled from `?search=` through the DOM `value` property, never HTML, and the XSS tests cover it. |
| 10027 Suspicious Comments | Kept as a warning. The match is the comment "textContent, never innerHTML" in `products.js`. |
| 10049, 10111 | Informational, now ignored. |

The API tests above check the same headers in-process on every request type; ZAP is the
independent, black-box check of the running app.

## Bugs these tests found

The tests and scans found four real problems in ShopLite, each fixed in its own commit:

1. `?search=a&search=b` and `?category=a&category=b` crashed with **500**: Express turns repeated
   parameters into arrays, and SQLite can't bind an array.
2. `?sort=constructor` crashed with **500**: the allow-list lookup `SORTS[sort]` found an
   inherited object property, which then ended up in `ORDER BY`.
3. `/api/products/0x01` returned product 1: `Number()` accepts hex, exponent and padded strings.
   Now only plain decimal digits are accepted.
4. The login form had no `method="post"` (found by ZAP): without JavaScript, the password went
   into the URL.
