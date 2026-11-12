const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Verifier } = require('@pact-foundation/pact');
const { createApp } = require('../../app/src/app');

// Verifies the real ShopLite API against the contract written by the consumer tests.
// Provider states put the database in the state each interaction expects.
describe('ShopLite API honours the shoplite-web contract', () => {
  let server;
  let app;
  let tmp;
  let currentToken = null;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shoplite-pact-'));
    app = createApp({ dbPath: path.join(tmp, 'provider.db'), loginRateLimit: 10000 });
    await new Promise((resolve) => { server = app.listen(0, resolve); });
  });

  afterAll(() => {
    server?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function loginAlice() {
    const { db, tokenStore } = app.locals;
    const { id } = db.prepare('SELECT id FROM users WHERE email = ?').get('alice@shoplite.test');
    currentToken = tokenStore.issue(id);
    return id;
  }

  function setCart(userId, lines) {
    const { db } = app.locals;
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    const insert = db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)');
    for (const [productId, quantity] of lines) insert.run(userId, productId, quantity);
  }

  it('verifies the pact', () => {
    const pactFile = path.resolve(__dirname, '..', 'pacts', 'shoplite-web-shoplite-api.json');
    if (!fs.existsSync(pactFile)) {
      throw new Error('Pact file not found. Run the consumer tests first: npm run test:consumer');
    }

    return new Verifier({
      provider: 'shoplite-api',
      providerBaseUrl: `http://127.0.0.1:${server.address().port}`,
      pactUrls: [pactFile],
      logLevel: 'warn',
      stateHandlers: {
        'products exist': () => Promise.resolve(),
        'product 1 exists': () => Promise.resolve(),
        'product 9999 does not exist': () => {
          app.locals.db.prepare('DELETE FROM products WHERE id = 9999').run();
          return Promise.resolve();
        },
        'user alice exists': () => Promise.resolve(),
        'alice is logged in with an empty cart': () => {
          setCart(loginAlice(), []);
          return Promise.resolve();
        },
        'alice is logged in and has 2 mugs in her cart': () => {
          setCart(loginAlice(), [[3, 2]]);
          return Promise.resolve();
        },
      },
      // The consumer used a placeholder token; swap in a real one issued by the state handler.
      requestFilter: (req, res, next) => {
        if (req.headers.authorization && currentToken) {
          req.headers.authorization = `Bearer ${currentToken}`;
        }
        next();
      },
    }).verifyProvider();
  });
});
