# Performance tests

Load and performance tests for ShopLite, from single-endpoint benchmarks to full user journeys.

| Tool | Folder | What it answers |
|------|--------|-----------------|
| Apache Bench | `ab/` | How fast is one endpoint under parallel requests? |
| JMeter | `jvm/src/test/jmeter/` | Can a fixed group of shoppers keep buying for a minute without errors? |
| Gatling | `jvm/src/test/java/` | How does the shop behave when visitors keep arriving at a growing rate? |
| Lighthouse CI | `lighthouse/` | How fast do pages load in a browser, and are they within their budgets? |

All four run in CI (jobs `performance-load` and `performance-lighthouse`) and fail the build when a
threshold is broken. Reports are uploaded as artifacts.

## Test data

`scripts/start-app.mjs` starts ShopLite on a throwaway database prepared for load:

- the 50 users in [`data/users.csv`](data/users.csv), so virtual users never share a cart;
- every in-stock product restocked to 1,000,000, so checkouts don't run out halfway through
  a test (the sold-out product stays sold out);
- the per-IP login limit raised, because every virtual user comes from the same machine.

```bash
cd app && npm ci && cd ..
node performance-tests/scripts/start-app.mjs 3400
```

## Apache Bench (`ab/benchmark.sh`)

Fires N requests with C in parallel at six endpoints, including an authenticated one and login.
A benchmark fails if any request fails or the 95th percentile is over its limit:

```bash
BASE_URL=http://127.0.0.1:3400 performance-tests/ab/benchmark.sh
```

Results on a MacBook (M-series), 20 parallel connections:

| Benchmark | Req/s | p95 | Limit |
|-----------|-------|-----|-------|
| product list | ~14,000 | 3 ms | 150 ms |
| product detail | ~26,000 | 1 ms | 100 ms |
| login | ~50 | 220 ms | 1,500 ms |

Login is about 300 times slower than everything else, by design: scrypt makes each password check
expensive so that stolen hashes are hard to crack. It is the endpoint to watch when capacity
planning, and it has its own, higher limit.

The limits are generous because CI runners are shared and noisy. They are there to catch big
regressions, such as an accidental N+1 query, not a 10 ms change. To see a failure, start the app
with `CHAOS_ENABLED=true`, add 200 ms of latency to `/api/products/` with `POST /__chaos`, and run
the script again: product detail fails as "too slow".

## JMeter (`jvm/src/test/jmeter/shoplite-load.jmx`)

A **closed** workload: 25 shoppers (threads), each logged in as its own user
(`perf-${__threadNum}`), loop through product list, product detail, add to cart, checkout and
order detail with 0.3-1 s of think time, for 60 seconds. Every response is checked for its status
code, the order must contain the product that was added, and a duration assertion turns any
response slower than 1 s into an error.

The plan runs through the [jmeter-maven-plugin](https://github.com/jmeter-maven-plugin/jmeter-maven-plugin),
so no JMeter installation is needed. It fails the build above 1% errors and writes the JMeter HTML
dashboard to `target/jmeter/reports/`:

```bash
cd performance-tests/jvm
./mvnw -Pjmeter verify                         # defaults: 25 threads, 60 s
./mvnw -Pjmeter verify -Dthreads=10 -Dduration=30
```

## Gatling (`jvm/src/test/java/shoplite/perf/ShopperJourneySimulation.java`)

An **open** workload, closer to real web traffic: new users arrive at a set rate whether or not
earlier ones have finished, so a slow server builds up a queue instead of slowing the test down.

- *Browsing visitors*: ramp from 1 to 10 new users per second over 20 s, then 10 per second for 40 s.
- *Buyers*: 50 users over 60 s, fed from `users.csv`, who log in, add a random product, check the
  cart and place an order.

Assertions fail the build if more than 1% of requests fail, or the 95th percentile is over 500 ms
(2 s for login, 500 ms for placing an order). The HTML report is in `target/gatling/`.

```bash
cd performance-tests/jvm && ./mvnw gatling:test
```

**Why both?** JMeter's closed model answers "can N users work at the same time?". Gatling's open
model answers "what happens at N arrivals per second?". A closed test can hide a slow server,
because slow responses also slow down the arrival of new requests.

## Lighthouse CI (`lighthouse/lighthouserc.cjs`)

Loads the home, product and login pages 3 times each in headless Chrome (desktop preset) and checks
the median run:

| Budget | Limit | Measured (home page) |
|--------|-------|----------------------|
| Performance score | ≥ 0.95 | 1.00 |
| First Contentful Paint | ≤ 1,000 ms | ~265 ms |
| Largest Contentful Paint | ≤ 1,500 ms | ~330 ms |
| Total Blocking Time | ≤ 100 ms | 0 ms |
| Cumulative Layout Shift | ≤ 0.05 | 0.014 |
| Total download | ≤ 60 KB, ≤ 20 requests | 27 KB, 13 requests |
| JavaScript / CSS / images | ≤ 20 / 15 / 30 KB | 8 / 6 / 6 KB |
| Third-party requests | 0 | 0 |

Lighthouse 12 removed `budget.json`, so the size budgets are `resource-summary` assertions.

```bash
cd performance-tests && npm ci && npm run lighthouse   # starts its own app on port 3410
```

**Found by Lighthouse:** the home and product pages had a layout shift of 0.059 and 0.072. The
footer was drawn under the still-empty page and jumped down when JavaScript added the content.
A sticky-footer layout fixed it; the screenshot baselines were updated in the same commit.
To check that a budget fails, add 20 KB to `app/public/css/styles.css`: all three pages fail on
`resource-summary.stylesheet.size` (26 KB found, 15 KB allowed).
