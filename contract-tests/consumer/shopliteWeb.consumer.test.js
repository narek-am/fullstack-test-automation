const path = require('node:path');
const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const { ShopLiteClient } = require('./shopliteClient');

const { like, eachLike, integer, string, boolean, regex, atLeastOneLike } = MatchersV3;

const provider = new PactV3({
  consumer: 'shoplite-web',
  provider: 'shoplite-api',
  dir: path.resolve(__dirname, '..', 'pacts'),
  logLevel: 'warn',
});

// Example values are only used by the mock server; matchers say what the provider must
// guarantee (types and formats), so the contract doesn't break on harmless data changes.
const product = {
  id: integer(1),
  sku: regex(/^[A-Z]{2}-\d{3}$/, 'BK-001'),
  name: string('Testing Handbook'),
  description: string('A practical guide to software testing.'),
  category: string('books'),
  priceCents: integer(2999),
  stock: integer(25),
  inStock: boolean(true),
  image: string('/img/book.svg'),
};

const cartLine = {
  productId: integer(3),
  name: string('Bug Hunter Mug'),
  image: string('/img/mug.svg'),
  unitPriceCents: integer(1299),
  stock: integer(50),
  quantity: integer(2),
};

const AUTH = { Authorization: like('Bearer some-valid-token') };

describe('ShopLite web client ↔ ShopLite API contract', () => {
  describe('products', () => {
    it('lists products', async () => {
      provider
        .given('products exist')
        .uponReceiving('a request for the product list')
        .withRequest({ method: 'GET', path: '/api/products', headers: { Accept: 'application/json' } })
        .willRespondWith({
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: { items: eachLike(product), total: integer(6) },
        });

      await provider.executeTest(async (mock) => {
        const { products, total } = await new ShopLiteClient(mock.url).listProducts();
        expect(total).toBe(6);
        expect(products[0]).toMatchObject({ name: 'Testing Handbook', price: 29.99 });
      });
    });

    it('filters products by category', async () => {
      provider
        .given('products exist')
        .uponReceiving('a request for products in one category')
        .withRequest({ method: 'GET', path: '/api/products', query: { category: 'books' } })
        .willRespondWith({ status: 200, body: { items: atLeastOneLike({ ...product, category: 'books' }), total: integer(2) } });

      await provider.executeTest(async (mock) => {
        const { products } = await new ShopLiteClient(mock.url).listProducts({ category: 'books' });
        expect(products.every((p) => p.category === 'books')).toBe(true);
      });
    });

    it('gets one product', async () => {
      provider
        .given('product 1 exists')
        .uponReceiving('a request for product 1')
        .withRequest({ method: 'GET', path: '/api/products/1' })
        .willRespondWith({ status: 200, body: product });

      await provider.executeTest(async (mock) => {
        const p = await new ShopLiteClient(mock.url).getProduct(1);
        expect(p.sku).toBe('BK-001');
      });
    });

    it('handles a missing product', async () => {
      provider
        .given('product 9999 does not exist')
        .uponReceiving('a request for a missing product')
        .withRequest({ method: 'GET', path: '/api/products/9999' })
        .willRespondWith({ status: 404, body: { error: string('Product not found') } });

      await provider.executeTest(async (mock) => {
        await expect(new ShopLiteClient(mock.url).getProduct(9999)).rejects.toMatchObject({ status: 404 });
      });
    });
  });

  describe('auth', () => {
    it('logs in', async () => {
      provider
        .given('user alice exists')
        .uponReceiving('a login with valid credentials')
        .withRequest({
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { email: 'alice@shoplite.test', password: 'Passw0rd!' },
        })
        .willRespondWith({
          status: 200,
          body: {
            token: string('opaque-token'),
            user: { id: integer(1), email: string('alice@shoplite.test'), name: string('Alice Customer'), role: regex(/^(customer|admin)$/, 'customer') },
          },
        });

      await provider.executeTest(async (mock) => {
        const client = new ShopLiteClient(mock.url);
        const session = await client.login('alice@shoplite.test', 'Passw0rd!');
        expect(session.user.name).toBe('Alice Customer');
        expect(client.token).toBe('opaque-token');
      });
    });

    it('rejects wrong credentials', async () => {
      provider
        .given('user alice exists')
        .uponReceiving('a login with a wrong password')
        .withRequest({ method: 'POST', path: '/api/auth/login', body: { email: 'alice@shoplite.test', password: 'wrong' } })
        .willRespondWith({ status: 401, body: { error: string('Invalid email or password') } });

      await provider.executeTest(async (mock) => {
        await expect(new ShopLiteClient(mock.url).login('alice@shoplite.test', 'wrong')).rejects.toMatchObject({ status: 401 });
      });
    });
  });

  describe('cart and orders', () => {
    it('adds an item to the cart', async () => {
      provider
        .given('alice is logged in with an empty cart')
        .uponReceiving('a request to add 2 mugs to the cart')
        .withRequest({ method: 'POST', path: '/api/cart/items', headers: AUTH, body: { productId: 3, quantity: 2 } })
        .willRespondWith({
          status: 201,
          body: { items: eachLike(cartLine), subtotalCents: integer(2598), shippingCents: integer(499), totalCents: integer(3097) },
        });

      await provider.executeTest(async (mock) => {
        const cart = await new ShopLiteClient(mock.url, 'some-valid-token').addToCart(3, 2);
        expect(cart.totalCents).toBe(3097);
        expect(cart.items[0].quantity).toBe(2);
      });
    });

    it('gets the cart', async () => {
      provider
        .given('alice is logged in and has 2 mugs in her cart')
        .uponReceiving('a request for the cart')
        .withRequest({ method: 'GET', path: '/api/cart', headers: AUTH })
        .willRespondWith({
          status: 200,
          body: { items: eachLike(cartLine), subtotalCents: integer(2598), shippingCents: integer(499), totalCents: integer(3097) },
        });

      await provider.executeTest(async (mock) => {
        const cart = await new ShopLiteClient(mock.url, 'some-valid-token').getCart();
        expect(cart.items).toHaveLength(1);
      });
    });

    it('needs a token for the cart', async () => {
      provider
        .uponReceiving('a cart request without a token')
        .withRequest({ method: 'GET', path: '/api/cart' })
        .willRespondWith({ status: 401, body: { error: string('Authentication required') } });

      await provider.executeTest(async (mock) => {
        await expect(new ShopLiteClient(mock.url).getCart()).rejects.toMatchObject({ status: 401 });
      });
    });

    it('places an order', async () => {
      provider
        .given('alice is logged in and has 2 mugs in her cart')
        .uponReceiving('a request to place an order')
        .withRequest({ method: 'POST', path: '/api/orders', headers: AUTH })
        .willRespondWith({
          status: 201,
          body: {
            id: integer(1),
            userId: integer(1),
            status: regex(/^(PLACED|SHIPPED|CANCELLED)$/, 'PLACED'),
            totalCents: integer(3097),
            createdAt: regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, '2026-01-15T10:30:00.000Z'),
            items: eachLike({ productId: integer(3), name: string('Bug Hunter Mug'), quantity: integer(2), unitPriceCents: integer(1299) }),
          },
        });

      await provider.executeTest(async (mock) => {
        const order = await new ShopLiteClient(mock.url, 'some-valid-token').placeOrder();
        expect(order.status).toBe('PLACED');
      });
    });
  });
});
