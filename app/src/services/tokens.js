const crypto = require('node:crypto');

// Opaque bearer tokens kept in memory. Good enough for a demo app and easy to reason about in tests.
class TokenStore {
  constructor({ ttlMinutes = 60, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.now = now;
    this.tokens = new Map();
  }

  issue(userId) {
    const token = crypto.randomBytes(24).toString('base64url');
    this.tokens.set(token, { userId, expiresAt: this.now() + this.ttlMs });
    return token;
  }

  resolve(token) {
    const entry = this.tokens.get(token);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.tokens.delete(token);
      return null;
    }
    return entry.userId;
  }

  revoke(token) {
    this.tokens.delete(token);
  }
}

module.exports = { TokenStore };
