# Data tests

Checks that the data ShopLite stores is correct and consistent, not just that the API answers.

## SQL data-quality checks (`sql/checks/`)

Each check is a SQL query that returns the rows that **break** a rule: zero rows means pass.

| Check | Rule |
|-------|------|
| `01_no_negative_stock` | Stock never below zero |
| `02_unique_sku` | SKUs unique, case-insensitive |
| `03_emails_normalised` | Emails lower-case, trimmed and well-formed |
| `04_passwords_hashed` | Passwords stored as `salt:hash`, never plain text |
| `05_orders_have_items` | No order without lines |
| `06_order_total_matches_lines` | Stored total = lines + shipping rule |
| `07_no_orphan_rows` | Referential integrity across all tables |
| `08_price_snapshot` | Prices paid are positive and plausible (catches cents/dollars mix-ups) |
| `09_timestamps_iso8601` | `created_at` is UTC ISO-8601 and not in the future |
| `10_cart_within_stock` | Cart quantities within 1..99 and current stock |

## Tests (`test/dataQuality.test.js`)

1. **After real usage:** a shopping session is run through the API, then every check must pass,
   plus a stock-conservation check (seed stock - units sold = current stock).
2. **Mutation tests for the checks:** each check runs against a database that was corrupted on
   purpose (constraints bypassed, like a bad migration would) and must report the problem.
   A check that never fails is worthless, so this proves each one works.

```bash
npm install
npm test
node run-checks.js path/to/shoplite.db   # run the checks against any ShopLite database
```

## JDBC tests (Java)

`java-tests/src/test/java/com/shoplite/data/OrderPersistenceJdbcTest.java` acts through the API
(REST Assured) and verifies the stored rows over a **read-only JDBC connection**: order header and
lines, stock decrement, cart cleared, rollback on failed checkout, hashed passwords.
Run with `./mvnw test -Dgroups=data` in `java-tests/`.

## Kafka event tests (`kafka/`)

When an order is placed, ShopLite publishes an `order.created` event (`app/src/services/events.js`).
`orderEvents.kafka.test.js` wires the real app to a real Kafka broker, places orders through the API
and consumes the topic to check:

- exactly one message per order, keyed by order id
- the message body (type, ISO timestamp, order id, user id, total, lines) matches the stored order
- no personal data (emails, passwords) in the event
- no event for a failed checkout
- the event total follows the pricing rules

The broker comes from **Testcontainers** (`@testcontainers/kafka`, single-node KRaft) unless
`KAFKA_BROKERS` points at an existing one:

```bash
npm run test:kafka                                  # needs Docker
KAFKA_BROKERS=localhost:9092 npm run test:kafka     # use a broker that is already running
```
