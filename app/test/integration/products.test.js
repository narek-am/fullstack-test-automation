const { buildApp, loginAs, request } = require('../helpers/testApp');

describe('Products API', () => {
  let app;
  beforeEach(() => { app = buildApp(); });

  it('lists all seeded products sorted by name', async () => {
    const res = await request(app).get('/api/products').expect(200);
    expect(res.body.total).toBe(6);
    const names = res.body.items.map((p) => p.name);
    expect(names).toEqual([...names].sort());
  });

  it('returns the documented product shape', async () => {
    const res = await request(app).get('/api/products/1').expect(200);
    expect(res.body).toEqual({
      id: 1,
      sku: 'BK-001',
      name: 'Testing Handbook',
      description: expect.any(String),
      category: 'books',
      priceCents: 2999,
      stock: 25,
      inStock: true,
      image: '/img/book.svg',
    });
  });

  it('searches by name and description, case-insensitively', async () => {
    const res = await request(app).get('/api/products').query({ search: 'MUG' }).expect(200);
    expect(res.body.items.map((p) => p.sku)).toEqual(['MG-001']);
  });

  it('filters by category and sorts by price', async () => {
    const res = await request(app).get('/api/products').query({ category: 'merch', sort: 'price_desc' }).expect(200);
    expect(res.body.items.map((p) => p.priceCents)).toEqual([1999, 1299]);
  });

  it('marks products with zero stock as out of stock', async () => {
    const res = await request(app).get('/api/products').query({ search: 'Headphones' });
    expect(res.body.items[0]).toMatchObject({ stock: 0, inStock: false });
  });

  it('lists distinct categories', async () => {
    const res = await request(app).get('/api/products/categories').expect(200);
    expect(res.body).toEqual(['books', 'hardware', 'merch']);
  });

  it.each([
    ['/api/products/999', 404],
    ['/api/products/abc', 400],
    ['/api/products/0', 400],
    ['/api/products?sort=random', 400],
  ])('GET %s -> %i', async (url, status) => {
    await request(app).get(url).expect(status);
  });

  describe('PATCH /api/products/:id/stock', () => {
    it('lets an admin update stock', async () => {
      const admin = await loginAs(app, 'admin@shoplite.test', 'Adm1nPass!');
      const res = await request(app).patch('/api/products/6/stock').set(admin).send({ stock: 4 }).expect(200);
      expect(res.body).toMatchObject({ stock: 4, inStock: true });
    });

    it('forbids customers', async () => {
      const alice = await loginAs(app);
      await request(app).patch('/api/products/6/stock').set(alice).send({ stock: 4 }).expect(403);
    });

    it('requires authentication', async () => {
      await request(app).patch('/api/products/6/stock').send({ stock: 4 }).expect(401);
    });

    it('validates the stock value', async () => {
      const admin = await loginAs(app, 'admin@shoplite.test', 'Adm1nPass!');
      await request(app).patch('/api/products/1/stock').set(admin).send({ stock: -1 }).expect(400);
    });
  });
});
