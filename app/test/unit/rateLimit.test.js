const { rateLimit } = require('../../src/middleware/rateLimit');

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('rateLimit middleware', () => {
  it('allows up to the limit, then answers 429 with Retry-After', () => {
    let clock = 0;
    const limiter = rateLimit({ limit: 2, windowMs: 10_000, now: () => clock });
    const req = { ip: '10.0.0.1' };
    const next = jest.fn();

    limiter(req, fakeRes(), next);
    limiter(req, fakeRes(), next);
    const blocked = fakeRes();
    clock = 4_000;
    limiter(req, blocked, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBe(6);
  });

  it('counts each client IP separately and resets after the window', () => {
    let clock = 0;
    const limiter = rateLimit({ limit: 1, windowMs: 1_000, now: () => clock });
    const next = jest.fn();

    limiter({ ip: 'a' }, fakeRes(), next);
    limiter({ ip: 'b' }, fakeRes(), next);
    clock = 1_000;
    limiter({ ip: 'a' }, fakeRes(), next);

    expect(next).toHaveBeenCalledTimes(3);
  });
});
