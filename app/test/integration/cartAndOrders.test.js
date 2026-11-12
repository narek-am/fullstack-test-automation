const { buildApp, loginAs, request } = require('../helpers/testApp');

describe('Cart and checkout flow', () => {
  let app;
  let alice;

  beforeEach(async () => {
    app = buildApp();
    alice = await loginAs(app);
  });

  const addToCart = (auth, productId, quantity) =>
    request(app).post('/api/cart/items').set(auth).send({ productId, quantity });

  it('starts with an empty cart', async () => {
    const res = await request(app).get('/api/cart').set(alice).expect(200);
    expect(res.body).toEqual({ items: [], subtotalCents: 0, shippingCents: 0, totalCents: 0 });
  });

  it('adds items, merges quantities and calculates totals', async () => {
    await addToCart(alice, 3, 1).expect(201);
    const res = await addToCart(alice, 3, 2).expect(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ productId: 3, quantity: 3, unitPriceCents: 1299 });
    expect(res.body).toMatchObject({ subtotalCents: 3897, shippingCents: 499, totalCents: 4396 });
  });

  it('refuses to add more than the available stock', async () => {
    const res = await addToCart(alice, 5, 4).expect(409); // keyboard stock is 3
    expect(res.body.available).toBe(3);
  });

  it('refuses out-of-stock products and unknown products', async () => {
    await addToCart(alice, 6, 1).expect(409);
    await addToCart(alice, 999, 1).expect(404);
  });

  it('updates and removes cart lines', async () => {
    await addToCart(alice, 1, 1);
    const updated = await request(app).put('/api/cart/items/1').set(alice).send({ quantity: 2 }).expect(200);
    expect(updated.body.items[0].quantity).toBe(2);
    const removed = await request(app).delete('/api/cart/items/1').set(alice).expect(200);
    expect(removed.body.items).toEqual([]);
  });

  it('keeps carts separate per user', async () => {
    const bob = await loginAs(app, 'bob@shoplite.test');
    await addToCart(alice, 1, 1);
    const res = await request(app).get('/api/cart').set(bob).expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('requires authentication for the cart', async () => {
    await request(app).get('/api/cart').expect(401);
  });

  describe('placing an order', () => {
    it('creates the order, reduces stock, empties the cart and emits an event', async () => {
      await addToCart(alice, 1, 2);
      await addToCart(alice, 3, 1);

      const res = await request(app).post('/api/orders').set(alice).expect(201);

      expect(res.body).toMatchObject({ status: 'PLACED', totalCents: 2 * 2999 + 1299 });
      expect(res.body.items).toHaveLength(2);
      const product = await request(app).get('/api/products/1');
      expect(product.body.stock).toBe(23);
      const cart = await request(app).get('/api/cart').set(alice);
      expect(cart.body.items).toEqual([]);

      const [event] = app.locals.eventBus.history;
      expect(event.type).toBe('order.created');
      expect(event.payload).toMatchObject({ orderId: res.body.id, userId: 1, totalCents: res.body.totalCents });
    });

    it('rejects checkout of an empty cart', async () => {
      await request(app).post('/api/orders').set(alice).expect(400);
    });

    it('rolls back everything if stock ran out after items were added', async () => {
      const admin = await loginAs(app, 'admin@shoplite.test', 'Adm1nPass!');
      await addToCart(alice, 1, 1);
      await addToCart(alice, 5, 2);
      await request(app).patch('/api/products/5/stock').set(admin).send({ stock: 1 });

      await request(app).post('/api/orders').set(alice).expect(409);

      const book = await request(app).get('/api/products/1');
      expect(book.body.stock).toBe(25); // first line was not decremented
      const orders = await request(app).get('/api/orders').set(alice);
      expect(orders.body).toEqual([]);
    });

    it('lists only the current user\'s orders and hides others\' orders', async () => {
      const bob = await loginAs(app, 'bob@shoplite.test');
      await addToCart(alice, 1, 1);
      const { body: order } = await request(app).post('/api/orders').set(alice).expect(201);

      const mine = await request(app).get('/api/orders').set(alice).expect(200);
      expect(mine.body.map((o) => o.id)).toEqual([order.id]);
      await request(app).get(`/api/orders/${order.id}`).set(alice).expect(200);
      await request(app).get(`/api/orders/${order.id}`).set(bob).expect(404);
      const bobs = await request(app).get('/api/orders').set(bob).expect(200);
      expect(bobs.body).toEqual([]);
    });

    it('lets an admin read any order', async () => {
      const admin = await loginAs(app, 'admin@shoplite.test', 'Adm1nPass!');
      await addToCart(alice, 1, 1);
      const { body: order } = await request(app).post('/api/orders').set(alice);
      await request(app).get(`/api/orders/${order.id}`).set(admin).expect(200);
    });
  });
});
