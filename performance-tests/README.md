# Performance tests

Load and performance tests for ShopLite, from single-endpoint benchmarks to full user journeys.

| Tool | Folder | What it answers |
|------|--------|-----------------|
| Apache Bench | `ab/` | How fast is one endpoint under parallel requests? |

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
