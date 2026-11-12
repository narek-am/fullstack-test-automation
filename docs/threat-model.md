# ShopLite Threat Model (STRIDE)

## Scope

```
 Browser ──HTTPS──▶ Express API ──▶ SQLite database
   │                    │
   └─ localStorage       └──▶ Event bus ──▶ Kafka (optional)
      (session token)
```

**Assets:** customer accounts, session tokens, order history, product prices and stock.
**Trust boundaries:** browser ↔ API, API ↔ database, API ↔ Kafka.

## Threats

| # | STRIDE | Threat | Mitigation in ShopLite | Verified by |
|---|--------|--------|------------------------|-------------|
| T1 | **S**poofing | Attacker guesses passwords (brute force, credential stuffing) | Login rate limit per IP; scrypt password hashes | `rateLimit.test.js`, security tests |
| T2 | **S**poofing | Stolen or guessed session token | 192-bit random tokens; expiry; revoked on logout | `tokens.test.js`, `auth.test.js` |
| T3 | **T**ampering | SQL injection through search or IDs | Parameterised queries only; sort is an allow-list | Security tests, ZAP scan |
| T4 | **T**ampering | Client changes price or total in the request | Server ignores client prices and calculates totals itself | Integration + security tests |
| T5 | **R**epudiation | User denies placing an order | Orders stored with user ID and timestamp; `order.created` event | Data tests |
| T6 | **I**nformation disclosure | User reads another user's orders (IDOR) | Ownership check; returns 404, not 403, so IDs can't be probed | `cartAndOrders.test.js`, security tests |
| T7 | **I**nformation disclosure | Login reveals which emails exist | Same error for unknown user and wrong password | `auth.test.js` |
| T8 | **I**nformation disclosure | Stack traces or SQL in error responses | Generic 500 message; details only in server logs | Security tests |
| T9 | **I**nformation disclosure | Secrets committed to git | Talisman pre-commit hook; no secrets in the repo | Talisman |
| T10 | **D**enial of service | Huge request bodies or slow endpoints | 10 KB JSON body limit; load tests with targets | Security + performance tests |
| T11 | **E**levation of privilege | Customer calls admin-only stock endpoint | Role check on the route | `products.test.js` |
| T12 | **E**levation of privilege | XSS through product names | `textContent` only in the frontend; strict CSP | Security tests, ZAP scan |
| T13 | Supply chain | Vulnerable npm/Maven dependency | `npm audit` gate on production dependencies; OSV-Scanner for npm and Maven | CI `security-dependencies` job |
| T14 | Clickjacking | Shop loaded in a hostile iframe | `X-Frame-Options: DENY`, `frame-ancestors 'none'` | Security tests |

## Known gaps (accepted for a demo app)

- Tokens are kept in `localStorage`, so an XSS bug would expose them. CSP reduces the risk.
  A production version would use `HttpOnly`, `SameSite` cookies.
- The rate limiter is in memory and per process, so it would not hold across several instances.
- No HTTPS in local runs. TLS would be terminated by the hosting platform.

## Review

Update this model whenever a new endpoint, data store or third-party integration is added.
