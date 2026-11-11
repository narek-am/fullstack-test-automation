const express = require('express');
const { requirePositiveInt } = require('../services/validation');
const pricing = require('../services/pricing');

function loadCart(db, userId) {
  const lines = db
    .prepare(
      `SELECT p.id AS productId, p.name, p.image, p.price_cents AS unitPriceCents, p.stock, c.quantity
       FROM cart_items c JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ? ORDER BY p.name`,
    )
    .all(userId);
  return { items: lines, ...pricing.total(lines) };
}

module.exports = function cartRoutes({ db, authenticateUser }) {
  const router = express.Router();
  router.use(authenticateUser);

  router.get('/', (req, res) => res.json(loadCart(db, req.user.id)));

  router.post('/items', (req, res) => {
    const productId = requirePositiveInt(req.body?.productId, 'productId', { max: Number.MAX_SAFE_INTEGER });
    const quantity = requirePositiveInt(req.body?.quantity ?? 1, 'quantity');
    const product = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const existing = db
      .prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?')
      .get(req.user.id, productId);
    const newQuantity = (existing?.quantity ?? 0) + quantity;
    if (newQuantity > product.stock) {
      return res.status(409).json({ error: 'Not enough stock', available: product.stock });
    }
    db.prepare(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = excluded.quantity`,
    ).run(req.user.id, productId, newQuantity);
    return res.status(201).json(loadCart(db, req.user.id));
  });

  router.put('/items/:productId', (req, res) => {
    const productId = requirePositiveInt(req.params.productId, 'productId', { max: Number.MAX_SAFE_INTEGER });
    const quantity = requirePositiveInt(req.body?.quantity, 'quantity');
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (quantity > product.stock) {
      return res.status(409).json({ error: 'Not enough stock', available: product.stock });
    }
    const result = db
      .prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?')
      .run(quantity, req.user.id, productId);
    if (result.changes === 0) return res.status(404).json({ error: 'Item is not in the cart' });
    return res.json(loadCart(db, req.user.id));
  });

  router.delete('/items/:productId', (req, res) => {
    const productId = requirePositiveInt(req.params.productId, 'productId', { max: Number.MAX_SAFE_INTEGER });
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, productId);
    res.json(loadCart(db, req.user.id));
  });

  return router;
};

module.exports.loadCart = loadCart;
