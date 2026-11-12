const request = require('supertest');
const { createApp } = require('../../src/app');

// Every test file gets its own in-memory database, so tests never share state.
function buildApp(overrides = {}) {
  return createApp({ dbPath: ':memory:', loginRateLimit: 1000, ...overrides });
}

async function loginAs(app, email = 'alice@shoplite.test', password = 'Passw0rd!') {
  const res = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  return { Authorization: `Bearer ${res.body.token}` };
}

module.exports = { buildApp, loginAs, request };
