const express = require('express');
const { withTransaction } = require('../db');
const { requirePositiveInt } = require('../services/validation');
const { loadCart } = require('../services/cart');

class ConflictError extends Error {
  constructor(message, details) {
    super(message);
    this.status = 409;
    this.details = details;
  }
}

module.exports = function orderRoutes({ db, authenticateUser, eventBus }) {
  const router = express.Router();
  router.use(authenticateUser);

  function loadOrder(orderId) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return null;
    const items = db
      .prepare(
        `SELECT oi.product_id AS productId, p.name, oi.quantity, oi.unit_price_cents AS unitPriceCents
         FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
      )
      .all(orderId);
    return {
      id: order.id,
      userId: order.user_id,
      status: order.status,
      totalCents: order.total_cents,
      createdAt: order.created_at,
      items,
    };
  }

  router.post('/', async (req, res) => {
    const cart = loadCart(db, req.user.id);
    if (cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    let orderId;
    try {
      orderId = withTransaction(db, () => {
        const decrement = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
        for (const line of cart.items) {
          const result = decrement.run(line.quantity, line.productId, line.quantity);
          if (result.changes === 0) {
            throw new ConflictError('Not enough stock', { productId: line.productId });
          }
        }
        const { lastInsertRowid } = db
          .prepare('INSERT INTO orders (user_id, total_cents) VALUES (?, ?)')
          .run(req.user.id, cart.totalCents);
        const insertItem = db.prepare(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)',
        );
        for (const line of cart.items) {
          insertItem.run(lastInsertRowid, line.productId, line.quantity, line.unitPriceCents);
        }
        db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
        return Number(lastInsertRowid);
      });
    } catch (err) {
      if (err instanceof ConflictError) return res.status(409).json({ error: err.message, ...err.details });
      throw err;
    }

    const order = loadOrder(orderId);
    await eventBus.publish('order.created', {
      orderId: order.id,
      userId: order.userId,
      totalCents: order.totalCents,
      items: order.items.map(({ productId, quantity }) => ({ productId, quantity })),
    });
    return res.status(201).json(order);
  });

  router.get('/', (req, res) => {
    const ids = db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
    res.json(ids.map(({ id }) => loadOrder(id)));
  });

  router.get('/:id', (req, res) => {
    const id = requirePositiveInt(req.params.id, 'id', { max: Number.MAX_SAFE_INTEGER });
    const order = loadOrder(id);
    // Return 404 (not 403) for other users' orders so order IDs can't be probed.
    if (!order || (order.userId !== req.user.id && req.user.role !== 'admin')) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json(order);
  });

  return router;
};
