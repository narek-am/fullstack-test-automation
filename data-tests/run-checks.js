// Runs the data-quality checks against an existing ShopLite database file.
// Usage: node run-checks.js [path/to/shoplite.db]   (exit code 1 if any check fails)
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { loadChecks, runCheck } = require('./checks');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'app', 'data', 'shoplite.db');
const db = new DatabaseSync(dbPath, { readOnly: true });

let failed = 0;
for (const check of loadChecks()) {
  const rows = runCheck(db, check);
  const ok = rows.length === 0;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${check.name}  ${ok ? '' : `(${rows.length} bad rows)`}`);
  if (!ok) console.table(rows.slice(0, 10));
}
console.log(`\n${failed === 0 ? 'All checks passed' : `${failed} check(s) failed`} on ${dbPath}`);
process.exitCode = failed === 0 ? 0 : 1;
