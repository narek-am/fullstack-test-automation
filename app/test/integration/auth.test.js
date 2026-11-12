const { buildApp, loginAs, request } = require('../helpers/testApp');

describe('Auth API', () => {
  let app;
  beforeEach(() => { app = buildApp(); });

  it('logs in with valid credentials and returns a token and profile', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'Alice@ShopLite.test', password: 'Passw0rd!' })
      .expect(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: 1, email: 'alice@shoplite.test', name: 'Alice Customer', role: 'customer' });
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('uses the same error for unknown users and wrong passwords', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'alice@shoplite.test', password: 'x' });
    const unknownUser = await request(app).post('/api/auth/login').send({ email: 'nobody@shoplite.test', password: 'x' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownUser.body);
  });

  it.each([
    [{}, 'email'],
    [{ email: 'not-an-email', password: 'x' }, 'email'],
    [{ email: 'alice@shoplite.test' }, 'password'],
  ])('rejects invalid body %j', async (body, field) => {
    const res = await request(app).post('/api/auth/login').send(body).expect(400);
    expect(res.body.field).toBe(field);
  });

  it('rejects malformed JSON with 400', async () => {
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400);
  });

  it('returns the current user for a valid token', async () => {
    const auth = await loginAs(app);
    const res = await request(app).get('/api/auth/me').set(auth).expect(200);
    expect(res.body.email).toBe('alice@shoplite.test');
  });

  it('invalidates the token on logout', async () => {
    const auth = await loginAs(app);
    await request(app).post('/api/auth/logout').set(auth).expect(204);
    await request(app).get('/api/auth/me').set(auth).expect(401);
  });

  it.each(['', 'Bearer', 'Bearer made-up-token', 'Basic abc'])('rejects Authorization header %p', async (header) => {
    await request(app).get('/api/auth/me').set('Authorization', header).expect(401);
  });
});
