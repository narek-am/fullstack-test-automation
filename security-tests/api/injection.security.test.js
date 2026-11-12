const { buildApp, users, tokenFor, bearer, expectNoLeak, request } = require('../helpers/shoplite');

// Threat model: T3 (SQL injection), T12 (XSS).
// Every payload must be handled as plain data: no extra rows, no errors from the database,
// no change to the data, and nothing reflected back as HTML.

const SQL_PAYLOADS = [
  "' OR '1'='1",
  "' OR 1=1 --",
  "%' OR '1'='1' --",
  '" OR ""="',
  "'; DROP TABLE products; --",
  "' UNION SELECT id, email, password_hash, role, name, 1, 1, 1, 1 FROM users --",
  "1' AND (SELECT COUNT(*) FROM users) > 0 --",
  "' AND sqlite_version() --",
];

const app = buildApp();

afterAll(async () => {
  // After every payload, the data must be untouched.
  const products = await request(app).get('/api/products').expect(200);
  expect(products.body.total).toBe(6);
  await request(app).post('/api/auth/login').send(users.admin).expect(200);
});

describe('SQL injection in the product search (T3)', () => {
  it.each(SQL_PAYLOADS)('search=%s finds nothing and leaks nothing', async (payload) => {
    const res = await request(app).get('/api/products').query({ search: payload });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.text).not.toMatch(/@shoplite\.test|scrypt|password/i);
    expectNoLeak(res);
  });

  it.each(SQL_PAYLOADS)('category=%s finds nothing', async (payload) => {
    const res = await request(app).get('/api/products').query({ category: payload });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it.each(['name; DROP TABLE products', 'price_cents', 'name ASC, (SELECT 1)', '1', '__proto__', 'hasOwnProperty'])(
    'sort=%s is refused by the allow-list',
    async (payload) => {
      const res = await request(app).get('/api/products').query({ sort: payload });
      expect(res.status).toBe(400);
      expectNoLeak(res);
    },
  );
});

describe('SQL injection in IDs and login (T3)', () => {
  it.each(['1 OR 1=1', '1;DROP TABLE orders', '1 UNION SELECT 1', "1'", '0x01', '-1', '1e3', '1.5'])(
    'product id "%s" is rejected as invalid',
    async (payload) => {
      const res = await request(app).get(`/api/products/${encodeURIComponent(payload)}`);
      expect(res.status).toBe(400);
      expectNoLeak(res);
    },
  );

  it.each([
    ["alice@shoplite.test'--", 'anything'],
    ["x'OR'1'='1@shoplite.test", "x'OR'1'='1"],
    ['alice@shoplite.test', "' OR '1'='1"],
  ])('login with email %s and password %s fails', async (email, password) => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect([400, 401]).toContain(res.status);
    expect(res.body.token).toBeUndefined();
    expectNoLeak(res);
  });

  it('treats a cart productId with SQL as invalid', async () => {
    const token = await tokenFor(app, users.bob);
    const res = await request(app).post('/api/cart/items').set(bearer(token)).send({ productId: '1 OR 1=1', quantity: 1 });
    expect(res.status).toBe(400);
  });
});

describe('Reflected XSS (T12)', () => {
  const XSS = '<script>alert(1)</script>';

  it('returns search terms only inside JSON, which the browser will not run', async () => {
    const res = await request(app).get('/api/products').query({ search: XSS });
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('does not echo the URL into the HTML 404 page', async () => {
    const res = await request(app).get(`/${encodeURIComponent(XSS)}`);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.text).not.toContain('<script>alert');
    expect(res.text).not.toContain('%3Cscript');
  });

  it('keeps the payload inert in JSON error messages', async () => {
    const res = await request(app).get(`/api/${encodeURIComponent(XSS)}`);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  });
});
