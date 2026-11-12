#!/usr/bin/env bash
# Apache Bench micro-benchmarks for single ShopLite endpoints.
# Each row: fire N requests with C in parallel, then check that none failed and that the
# 95th percentile stays under the limit. Limits are generous on purpose: shared CI runners are
# noisy, and the goal is to catch big regressions (an N+1 query, a missing index), not 10 ms.
#
# Usage: BASE_URL=http://127.0.0.1:3400 ./benchmark.sh    (start the app with ../scripts/start-app.mjs)
set -euo pipefail

BASE_URL=${BASE_URL:-http://127.0.0.1:3400}
OUT=${OUT:-results}
mkdir -p "$OUT"

token=$(curl -sSf -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"perf-1@shoplite.test","password":"Load-Test-1!"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
printf '{"email":"perf-2@shoplite.test","password":"Load-Test-1!"}' > "$OUT/login.json"

#    name             requests concurrency p95 limit (ms)  path   [auth | login]
CASES=(
  "product-list     2000     20          150             /api/products"
  "search-sorted    2000     20          150             /api/products?search=book&sort=price_asc"
  "product-detail   2000     20          100             /api/products/3"
  "home-page-html   2000     20          100             /"
  "cart-auth        1000     20          150             /api/cart        auth"
  # scrypt is deliberately slow (it protects passwords), so login has its own, higher budget.
  "login            200      10          1500            /api/auth/login  login"
)

failed=0
summary="| Benchmark | Requests | Concurrency | Req/s | Mean (ms) | p95 (ms) | p95 limit | Failed | Result |\n|---|---|---|---|---|---|---|---|---|\n"
for case in "${CASES[@]}"; do
  read -r name requests concurrency limit path mode <<<"$case"
  options=()
  case "${mode:-}" in
    auth) options=(-H "Authorization: Bearer $token") ;;
    login) options=(-p "$OUT/login.json" -T application/json) ;;
  esac
  ab -q -n "$requests" -c "$concurrency" ${options[@]+"${options[@]}"} "$BASE_URL$path" > "$OUT/$name.txt" 2>&1 || true
  file="$OUT/$name.txt"
  rps=$(awk '/^Requests per second/ {print $4}' "$file")
  mean=$(awk '/^Time per request/ && /\(mean\)/ {print $4; exit}' "$file")
  p95=$(awk '$1 == "95%" {print $2}' "$file")
  errors=$(awk '/^Failed requests/ {print $3}' "$file")
  non2xx=$(awk '/^Non-2xx responses/ {print $3}' "$file")
  errors=$(( ${errors:-1} + ${non2xx:-0} ))
  if [[ -z "$p95" ]]; then result="❌ ab failed"; failed=1
  elif (( errors > 0 )); then result="❌ $errors errors"; failed=1
  elif (( p95 > limit )); then result="❌ too slow"; failed=1
  else result="✅"; fi
  summary+="| $name | $requests | $concurrency | ${rps:-?} | ${mean:-?} | ${p95:-?} | $limit | $errors | $result |\n"
done

printf '%b' "$summary" | tee "$OUT/summary.md"
[[ -n "${GITHUB_STEP_SUMMARY:-}" ]] && printf '## Apache Bench\n\n%b\n' "$summary" >> "$GITHUB_STEP_SUMMARY"
exit "$failed"
