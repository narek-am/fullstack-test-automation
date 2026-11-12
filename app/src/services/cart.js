const pricing = require('./pricing');

// The current user's cart with prices and totals. Used by the cart and order routes, so it lives
// here rather than in either route (architecture rule: routes are independent).
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

module.exports = { loadCart };
