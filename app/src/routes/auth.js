const express = require('express');
const { verifyPassword } = require('../services/passwords');
const { requireEmail, requireString } = require('../services/validation');
const { rateLimit } = require('../middleware/rateLimit');

module.exports = function authRoutes({ db, tokenStore, authenticateUser, config }) {
  const router = express.Router();
  const findByEmail = db.prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?');

  router.post('/login', rateLimit({ limit: config.loginRateLimit }), (req, res) => {
    const email = requireEmail(req.body?.email);
    const password = requireString(req.body?.password, 'password', { max: 128 });
    const user = findByEmail.get(email);
    // Same message for unknown user and wrong password, so accounts can't be enumerated.
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = tokenStore.issue(user.id);
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  router.post('/logout', authenticateUser, (req, res) => {
    tokenStore.revoke(req.token);
    res.status(204).end();
  });

  router.get('/me', authenticateUser, (req, res) => {
    res.json(req.user);
  });

  return router;
};
