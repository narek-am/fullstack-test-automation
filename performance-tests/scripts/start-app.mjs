// Starts ShopLite for load tests on a throwaway database prepared with load-test data:
//   - the 50 virtual users from data/users.csv, so concurrent users never share a cart;
//   - every in-stock product restocked to 1,000,000, so checkouts don't run out mid-test
//     (the sold-out product stays sold out, to keep that path realistic).
// Usage: node scripts/start-app.mjs [port]     (default 3400)
import { mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..', '..', 'app');
const require = createRequire(join(appDir, 'package.json'));
const { openDatabase } = require('./src/db');
const { hashPassword } = require('./src/services/passwords');

const port = process.argv[2] ?? '3400';
const dbPath = join(mkdtempSync(join(tmpdir(), 'shoplite-perf-')), 'perf.db');

const db = openDatabase(dbPath);
const users = readFileSync(join(here, '..', 'data', 'users.csv'), 'utf8').trim().split('\n').slice(1);
const insertUser = db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'customer')");
db.exec('BEGIN');
for (const line of users) {
  const [email, password] = line.split(',');
  insertUser.run(email, `Load user ${email.split("@")[0].slice(5)}`, hashPassword(password));
}
db.prepare('UPDATE products SET stock = 1000000 WHERE stock > 0').run();
db.exec('COMMIT');
db.close();
console.log(`Prepared ${users.length} load-test users in ${dbPath}`);

const child = spawn(process.execPath, ['src/index.js'], {
  cwd: appDir,
  stdio: 'inherit',
  // Every virtual user logs in from the same IP, so the per-IP login limit is raised.
  env: { ...process.env, PORT: port, DB_PATH: dbPath, LOGIN_RATE_LIMIT: '1000000' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
