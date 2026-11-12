const { buildApp, users, tokenFor, bearer, request } = require('../helpers/shoplite');

// Threat model: T4 (client-side price tampering), T6 (IDOR), T11 (privilege escalation).

const app = buildApp();
let alice;
let bob;
let admin;

beforeAll(async () => {
  [alice, bob, admin] = await Promise.all([tokenFor(app, users.alice), tokenFor(app, users.bob), tokenFor(app, users.admin)]);
});

async function placeOrder(token, productId, quantity = 1) {
  await request(app).post('/api/cart/items').set(bearer(token)).send({ productId, quantity }).expect(201);
  const res = await request(app).post('/api/orders').set(bearer(token)).expect(201);
  return res.body;
}

describe('Every protected endpoint requires a login', () => {
  it.each([
    ['GET', '/api/auth/me'],
    ['POST', '/api/auth/logout'],
    ['GET', '/api/cart'],
    ['POST', '/api/cart/items'],
    ['PUT', '/api/cart/items/1'],
    ['DELETE', '/api/cart/items/1'],
    ['GET', '/api/orders'],
    ['POST', '/api/orders'],
    ['GET', '/api/orders/1'],
    ['PATCH', '/api/products/1/stock'],
  ])('%s %s -> 401', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path).send({});
    expect(res.status).toBe(401);
  });
});

describe('Insecure direct object references (T6)', () => {
  it("does not show one customer's order to another, and hides that it exists", async () => {
    const order = await placeOrder(alice, 3);

    const othersOrder = await request(app).get(`/api/orders/${order.id}`).set(bearer(bob));
    const missingOrder = await request(app).get('/api/orders/999999').set(bearer(bob));
    expect(othersOrder.status).toBe(404);
    // Same answer as for an order that doesn't exist, so order IDs can't be probed.
    expect(othersOrder.body).toEqual(missingOrder.body);

    const bobsList = await request(app).get('/api/orders').set(bearer(bob)).expect(200);
    expect(bobsList.body.map((o) => o.id)).not.toContain(order.id);
  });

  it('ignores a userId sent in the body: the cart owner always comes from the token', async () => {
    const aliceMe = await request(app).get('/api/auth/me').set(bearer(alice)).expect(200);
    await request(app)
      .post('/api/cart/items')
      .set(bearer(bob))
      .send({ productId: 1, quantity: 1, userId: aliceMe.body.id, user_id: aliceMe.body.id })
      .expect(201);

    const aliceCart = await request(app).get('/api/cart').set(bearer(alice)).expect(200);
    expect(aliceCart.body.items.map((i) => i.productId)).not.toContain(1);
    await request(app).delete('/api/cart/items/1').set(bearer(bob)).expect(200);
  });
});

describe('Privilege escalation (T11)', () => {
  it('stops a customer from changing stock, even when claiming to be an admin', async () => {
    const res = await request(app)
      .patch('/api/products/1/stock')
      .set(bearer(alice))
      .set('X-User-Role', 'admin')
      .send({ stock: 0, role: 'admin' });
    expect(res.status).toBe(403);
    const product = await request(app).get('/api/products/1').expect(200);
    expect(product.body.stock).toBeGreaterThan(0);
  });

  it('does not let extra login fields change the role', async () => {
    const res = await request(app).post('/api/auth/login').send({ ...users.alice, role: 'admin' }).expect(200);
    expect(res.body.user.role).toBe('customer');
  });

  it('lets a real admin change stock (the check is not just "deny everyone")', async () => {
    await request(app).patch('/api/products/2/stock').set(bearer(admin)).send({ stock: 10 }).expect(200);
  });
});

describe('Price tampering (T4)', () => {
  it('ignores prices and totals sent by the client', async () => {
    await request(app)
      .post('/api/cart/items')
      .set(bearer(bob))
      .send({ productId: 1, quantity: 1, priceCents: 1, unitPriceCents: 1 })
      .expect(201);
    const res = await request(app).post('/api/orders').set(bearer(bob)).send({ totalCents: 1, items: [] }).expect(201);

    expect(res.body.items).toEqual([expect.objectContaining({ productId: 1, quantity: 1, unitPriceCents: 2999 })]);
    // 29.99 + 4.99 shipping, calculated on the server.
    expect(res.body.totalCents).toBe(2999 + 499);
  });
});
