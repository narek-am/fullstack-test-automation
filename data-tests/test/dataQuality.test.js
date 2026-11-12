const request = require('supertest');
const { createApp } = require('../../app/src/app');
const seed = require('../../app/src/seed');
const { loadChecks, runCheck } = require('../checks');

const checks = loadChecks();

async function login(app, email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Passw0rd!' }).expect(200);
  return { Authorization: `Bearer ${res.body.token}` };
}

/** Drives the app through its public API so the data is produced by real code paths. */
async function simulateShopping(app) {
  const alice = await login(app, 'alice@shoplite.test');
  const bob = await login(app, 'bob@shoplite.test');
  const buy = async (auth, lines) => {
    for (const [productId, quantity] of lines) {
      await request(app).post('/api/cart/items').set(auth).send({ productId, quantity }).expect(201);
    }
    return request(app).post('/api/orders').set(auth).expect(201);
  };
  await buy(alice, [[1, 1]]); // below free-shipping threshold
  await buy(alice, [[2, 1], [3, 2]]); // above threshold
  await buy(bob, [[4, 5]]); // buys all remaining T-shirts
  await buy(bob, [[5, 1], [3, 1]]);
  // leave something in a cart, too
  await request(app).post('/api/cart/items').set(alice).send({ productId: 1, quantity: 2 }).expect(201);
  // a failed checkout must not leave partial data behind
  await request(app).post('/api/cart/items').set(bob).send({ productId: 4, quantity: 1 }).expect(409);
}

describe('ShopLite data quality', () => {
  let app;
  let db;

  beforeAll(async () => {
    app = createApp({ dbPath: ':memory:', loginRateLimit: 1000 });
    db = app.locals.db;
    await simulateShopping(app);
  });

  it('has a realistic amount of data to check', () => {
    expect(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n).toBe(4);
    expect(db.prepare('SELECT COUNT(*) AS n FROM order_items').get().n).toBe(6);
  });

  it.each(checks.map((c) => [c.name, c]))('%s passes after real usage', (_name, check) => {
    expect(runCheck(db, check)).toEqual([]);
  });

  it('conserves stock: seed stock - units sold = current stock', () => {
    const rows = db
      .prepare(
        `SELECT p.sku, p.stock, COALESCE(SUM(oi.quantity), 0) AS sold
         FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id
         GROUP BY p.id`,
      )
      .all();
    for (const row of rows) {
      const initial = seed.products.find((p) => p.sku === row.sku).stock;
      expect({ sku: row.sku, stock: row.stock }).toEqual({ sku: row.sku, stock: initial - row.sold });
    }
  });
});

// Each check must actually catch the problem it is written for. We corrupt a fresh database
// on purpose (bypassing the schema constraints, like a bad migration or manual fix would)
// and expect the check to report it.
describe('the checks detect corrupted data', () => {
  let db;

  beforeEach(async () => {
    const app = createApp({ dbPath: ':memory:', loginRateLimit: 1000 });
    await simulateShopping(app);
    db = app.locals.db;
    db.exec('PRAGMA foreign_keys = OFF; PRAGMA ignore_check_constraints = ON;');
  });

  const byName = (name) => checks.find((c) => c.name === name);

  it.each([
    ['01_no_negative_stock', 'UPDATE products SET stock = -1 WHERE id = 1'],
    ['02_unique_sku', "UPDATE products SET sku = 'bk-001' WHERE id = 2"],
    ['03_emails_normalised', "UPDATE users SET email = ' Alice@ShopLite.test' WHERE id = 1"],
    ['04_passwords_hashed', "UPDATE users SET password_hash = 'Passw0rd!' WHERE id = 2"],
    ['05_orders_have_items', 'INSERT INTO orders (user_id, total_cents) VALUES (1, 0)'],
    ['06_order_total_matches_lines', 'UPDATE orders SET total_cents = total_cents + 1 WHERE id = 1'],
    ['07_no_orphan_rows', 'DELETE FROM products WHERE id = 1'],
    ['08_price_snapshot', 'UPDATE order_items SET unit_price_cents = unit_price_cents * 100 WHERE order_id = 1'],
    ['09_timestamps_iso8601', "UPDATE orders SET created_at = '12/11/2026 10:00' WHERE id = 1"],
    ['10_cart_within_stock', 'UPDATE cart_items SET quantity = 500'],
  ])('%s catches: %s', (name, corruption) => {
    expect(byName(name)).toBeDefined();
    expect(runCheck(db, byName(name))).toEqual([]);
    db.exec(corruption);
    expect(runCheck(db, byName(name)).length).toBeGreaterThan(0);
  });

  it('every check has a mutation test', () => {
    expect(checks).toHaveLength(10);
  });
});
