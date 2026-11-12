const { buildApp, users, tokenFor, bearer, expectNoLeak, request } = require('../helpers/shoplite');

// Threat model: T8 (error details leaking), T10 (oversized requests), plus type confusion,
// prototype pollution and path traversal.

const app = buildApp();
let bob;

beforeAll(async () => {
  bob = await tokenFor(app, users.bob);
});

describe('Oversized and malformed requests (T10, T8)', () => {
  it('refuses JSON bodies over 10 KB', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@shoplite.test', password: 'x'.repeat(11 * 1024) });
    expect(res.status).toBe(413);
    expectNoLeak(res);
  });

  it.each(['{"email": "alice@shoplite.test", ', '{"email": undefined}', "{'email': 'single quotes'}", '[1, 2,'])(
    'answers malformed JSON %s with a short 400',
    async (body) => {
      const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Malformed JSON body' });
      expectNoLeak(res);
    },
  );

  it('rejects search terms over 100 characters', async () => {
    const res = await request(app).get('/api/products').query({ search: 'a'.repeat(101) });
    expect(res.status).toBe(400);
  });
});

describe('Type confusion', () => {
  it.each([
    ['email as an array', { email: ['alice@shoplite.test'], password: 'Passw0rd!' }],
    ['email as an object', { email: { $ne: null }, password: 'Passw0rd!' }],
    ['password as an object', { email: 'alice@shoplite.test', password: { $gt: '' } }],
    ['password as a number', { email: 'alice@shoplite.test', password: 12345 }],
    ['password as true', { email: 'alice@shoplite.test', password: true }],
  ])('login refuses %s', async (_, body) => {
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  it.each([
    ['productId as an object', { productId: { $gt: 0 }, quantity: 1 }],
    ['productId as an array', { productId: [1, 2], quantity: 1 }],
    ['a negative quantity', { productId: 1, quantity: -5 }],
    ['a fractional quantity', { productId: 1, quantity: 0.5 }],
    ['a huge quantity', { productId: 1, quantity: Number.MAX_SAFE_INTEGER }],
    ['a quantity in exponent form', { productId: 1, quantity: '1e1' }],
    ['a productId in hex', { productId: '0x01', quantity: 1 }],
  ])('the cart refuses %s', async (_, body) => {
    const res = await request(app).post('/api/cart/items').set(bearer(bob)).send(body);
    expect(res.status).toBe(400);
    expectNoLeak(res);
  });

  it.each(['/api/products?search=a&search=b', '/api/products?category=books&category=merch'])(
    '%s (parameter pollution) is a 400, not a crash',
    async (url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(400);
      expectNoLeak(res);
    },
  );

  it('does not turn bracket syntax into objects (no NoSQL-style operators)', async () => {
    // Express 5 uses the "simple" query parser: `search[$ne]` is just an unknown parameter name.
    const res = await request(app).get('/api/products?search[$ne]=x&category[$gt]=');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(6);
  });
});

describe('Prototype pollution', () => {
  it('does not let __proto__ in a request body change other objects or grant a role', async () => {
    const alice = await tokenFor(app, users.alice);
    await request(app)
      .post('/api/cart/items')
      .set(bearer(alice))
      .set('Content-Type', 'application/json')
      .send('{"productId": 3, "quantity": 1, "__proto__": {"role": "admin", "isAdmin": true}}');

    expect({}.role).toBeUndefined();
    expect({}.isAdmin).toBeUndefined();
    await request(app).patch('/api/products/3/stock').set(bearer(alice)).send({ stock: 0 }).expect(403);
  });
});

describe('Path traversal and hidden files', () => {
  it.each([
    '/..%2f..%2fpackage.json',
    '/%2e%2e/%2e%2e/app/package.json',
    '/js/..%2f..%2fsrc%2fconfig.js',
    '/css/%2e%2e%2f%2e%2e%2fsrc%2fdb.js',
    '/..%5c..%5cpackage.json',
    '/.env',
    '/.git/config',
    '/data/shoplite.db',
    '/src/config.js',
  ])('%s does not serve files outside public/', async (path) => {
    const res = await request(app).get(path);
    expect([400, 403, 404]).toContain(res.status);
    expect(res.text).not.toMatch(/"dependencies"|module\.exports|require\(|SQLite format|\[core\]/);
  });
});
