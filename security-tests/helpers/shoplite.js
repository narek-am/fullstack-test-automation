const request = require('supertest');
const { createApp } = require('../../app/src/app');

// Each test file builds its own app with an in-memory database.
// The login rate limit is high by default; the rate-limit tests set their own low limit.
function buildApp(overrides = {}) {
  return createApp({ dbPath: ':memory:', loginRateLimit: 1000, ...overrides });
}

const users = {
  alice: { email: 'alice@shoplite.test', password: 'Passw0rd!' },
  bob: { email: 'bob@shoplite.test', password: 'Passw0rd!' },
  admin: { email: 'admin@shoplite.test', password: 'Adm1nPass!' },
};

async function tokenFor(app, user) {
  const res = await request(app).post('/api/auth/login').send(user).expect(200);
  return res.body.token;
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Things that must never appear in a response body: stack frames, file paths, SQL engine errors.
const LEAK_PATTERNS = [/\bat \S+ \(/, /node_modules/, /\/src\/\w+/, /SQLITE/i, /syntax error/i, /ERR_[A-Z_]+/];

function expectNoLeak(res) {
  const text = res.text ?? JSON.stringify(res.body);
  for (const pattern of LEAK_PATTERNS) expect(text).not.toMatch(pattern);
}

module.exports = { buildApp, users, tokenFor, bearer, expectNoLeak, request };
