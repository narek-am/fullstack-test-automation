const { buildApp, users, tokenFor, bearer, request } = require('../helpers/shoplite');

// Threat model: T1 (password guessing), T2 (stolen or guessed tokens), T7 (account enumeration).

describe('Account enumeration (T7)', () => {
  const app = buildApp();

  it('answers an unknown email and a wrong password in exactly the same way', async () => {
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@shoplite.test', password: 'Passw0rd!' });
    const wrongPassword = await request(app).post('/api/auth/login').send({ ...users.alice, password: 'wrong-password' });
    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body).toEqual(wrongPassword.body);
  });

  it('treats the email case-insensitively, so case changes reveal nothing', async () => {
    const res = await request(app).post('/api/auth/login').send({ ...users.alice, email: 'ALICE@ShopLite.test' });
    expect(res.status).toBe(200);
  });
});

describe('Brute force protection (T1)', () => {
  const LIMIT = 3;

  it(`blocks the client after ${LIMIT} login attempts per minute, even with the right password`, async () => {
    const app = buildApp({ loginRateLimit: LIMIT });
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      await request(app).post('/api/auth/login').send({ ...users.alice, password: `guess-${attempt}` }).expect(401);
    }
    const blocked = await request(app).post('/api/auth/login').send(users.alice);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.token).toBeUndefined();
  });

  it('caps the password length, so huge inputs cannot make hashing expensive', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/login').send({ ...users.alice, password: 'x'.repeat(129) });
    expect(res.status).toBe(400);
  });
});

describe('Session tokens (T2)', () => {
  const app = buildApp();

  it('issues long, unique, unguessable tokens', async () => {
    const tokens = await Promise.all(Array.from({ length: 20 }, () => tokenFor(app, users.alice)));
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) {
      // 24 random bytes = 192 bits, base64url encoded.
      expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    }
  });

  it.each([
    ['no Authorization header', {}],
    ['an empty bearer token', { Authorization: 'Bearer ' }],
    ['a different scheme', { Authorization: `Basic ${Buffer.from('alice@shoplite.test:Passw0rd!').toString('base64')}` }],
    ['a made-up token', { Authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }],
    ['a token that is too long', { Authorization: `Bearer ${'A'.repeat(5000)}` }],
    ['SQL in the token', { Authorization: "Bearer ' OR '1'='1" }],
  ])('rejects %s with 401', async (_, headers) => {
    await request(app).get('/api/auth/me').set(headers).expect(401);
  });

  it('rejects a token after logout', async () => {
    const token = await tokenFor(app, users.alice);
    await request(app).post('/api/auth/logout').set(bearer(token)).expect(204);
    await request(app).get('/api/auth/me').set(bearer(token)).expect(401);
  });

  it('rejects an expired token', async () => {
    const shortLived = buildApp({ tokenTtlMinutes: 0 });
    const token = await tokenFor(shortLived, users.alice);
    await request(shortLived).get('/api/auth/me').set(bearer(token)).expect(401);
  });

  it('logging out one session does not log out the others', async () => {
    const phone = await tokenFor(app, users.alice);
    const laptop = await tokenFor(app, users.alice);
    await request(app).post('/api/auth/logout').set(bearer(phone)).expect(204);
    await request(app).get('/api/auth/me').set(bearer(laptop)).expect(200);
  });
});

describe('Sensitive data in responses', () => {
  const app = buildApp();

  it('never returns the password or its hash', async () => {
    const login = await request(app).post('/api/auth/login').send(users.alice).expect(200);
    const me = await request(app).get('/api/auth/me').set(bearer(login.body.token)).expect(200);
    for (const body of [login.body.user, me.body]) {
      expect(Object.keys(body).sort()).toEqual(['email', 'id', 'name', 'role']);
    }
    expect(login.text).not.toContain('Passw0rd!');
    expect(login.text).not.toMatch(/password/i);
  });
});
