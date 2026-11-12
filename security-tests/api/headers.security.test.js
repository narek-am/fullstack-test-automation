const { buildApp, request } = require('../helpers/shoplite');

// Threat model: T12 (XSS), T14 (clickjacking), T8 (information disclosure).
// Headers are checked on every kind of response, because a header that is only set on
// "happy path" routes is easy to miss on error pages and static files.

const app = buildApp();

const RESPONSES = [
  ['API JSON', '/api/products'],
  ['API 404', '/api/does-not-exist'],
  ['API 401', '/api/cart'],
  ['HTML page', '/'],
  ['HTML 404 page', '/no-such-page'],
  ['static CSS', '/css/styles.css'],
  ['static JS', '/js/api.js'],
];

function parseCsp(header) {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name, values]),
  );
}

describe.each(RESPONSES)('%s (%s)', (_, path) => {
  let res;
  beforeAll(async () => {
    res = await request(app).get(path);
  });

  it('sends the hardening headers', () => {
    expect(res.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'same-origin',
    });
    expect(res.headers['permissions-policy']).toContain('camera=()');
  });

  it('does not reveal the server technology', () => {
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers.server).toBeUndefined();
  });

  it('has a Content Security Policy that blocks inline and foreign scripts', () => {
    const csp = parseCsp(res.headers['content-security-policy']);
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    for (const values of Object.values(csp)) {
      expect(values).not.toContain("'unsafe-inline'");
      expect(values).not.toContain("'unsafe-eval'");
      expect(values).not.toContain('*');
    }
  });
});

describe('API responses', () => {
  it.each(['/api/products', '/api/does-not-exist', '/api/cart'])('%s is served as JSON, never as HTML', async (path) => {
    const res = await request(app).get(path);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  });

  it('does not allow cross-origin reads (no CORS headers for a foreign Origin)', async () => {
    const res = await request(app).get('/api/products').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not answer TRACE requests (cross-site tracing)', async () => {
    const res = await request(app).trace('/api/health');
    expect(res.status).not.toBe(200);
  });
});
