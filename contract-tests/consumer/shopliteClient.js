// The API calls the ShopLite web client makes (same endpoints and fields as app/public/js).
// The consumer contract tests exercise this client against a Pact mock server, so the
// contract only contains what the client really uses.
class ShopLiteClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(path, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.error ?? `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async listProducts(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    const { items, total } = await this.request(`/api/products${query ? `?${query}` : ''}`);
    return { total, products: items.map((p) => ({ ...p, price: p.priceCents / 100 })) };
  }

  getProduct(id) {
    return this.request(`/api/products/${id}`);
  }

  async login(email, password) {
    const session = await this.request('/api/auth/login', { method: 'POST', body: { email, password } });
    this.token = session.token;
    return session;
  }

  getCart() {
    return this.request('/api/cart');
  }

  addToCart(productId, quantity) {
    return this.request('/api/cart/items', { method: 'POST', body: { productId, quantity } });
  }

  placeOrder() {
    return this.request('/api/orders', { method: 'POST' });
  }
}

module.exports = { ShopLiteClient };
