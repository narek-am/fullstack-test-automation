const { buildApp, request } = require('../helpers/testApp');

describe('GET /api/health', () => {
  it('reports UP when the database answers', async () => {
    const res = await request(buildApp()).get('/api/health').expect(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.uptimeSeconds).toEqual(expect.any(Number));
  });

  it('answers unknown API routes with JSON 404', async () => {
    const res = await request(buildApp()).get('/api/nope').expect(404);
    expect(res.body.error).toMatch(/Not found/);
  });

  it('answers unknown pages with the HTML 404 page', async () => {
    const res = await request(buildApp()).get('/no-such-page').expect(404);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Page not found');
  });
});
