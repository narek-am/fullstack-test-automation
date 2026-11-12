const { TokenStore } = require('../../src/services/tokens');

describe('TokenStore', () => {
  let clock;
  let store;

  beforeEach(() => {
    clock = 1_000_000;
    store = new TokenStore({ ttlMinutes: 1, now: () => clock });
  });

  it('issues unique, URL-safe tokens', () => {
    const a = store.issue(1);
    const b = store.issue(1);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('resolves a token to its user until it expires', () => {
    const token = store.issue(42);
    clock += 59_999;
    expect(store.resolve(token)).toBe(42);
    clock += 1;
    expect(store.resolve(token)).toBeNull();
  });

  it('returns null for unknown and revoked tokens', () => {
    const token = store.issue(1);
    store.revoke(token);
    expect(store.resolve(token)).toBeNull();
    expect(store.resolve('made-up')).toBeNull();
  });
});
