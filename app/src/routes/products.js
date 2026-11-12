const express = require('express');
const { requirePositiveInt, ValidationError } = require('../services/validation');

function toDto(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCents: row.price_cents,
    stock: row.stock,
    inStock: row.stock > 0,
    image: row.image,
  };
}

module.exports = function productRoutes({ db, authenticateUser, requireAdmin }) {
  const router = express.Router();
  const SORTS = { name: 'name ASC', price_asc: 'price_cents ASC', price_desc: 'price_cents DESC' };

  // `?search=a&search=b` arrives as an array, which SQLite can't bind. Accept exactly one text value.
  function singleQueryValue(query, field, fallback) {
    const value = query[field] ?? fallback;
    if (typeof value !== 'string') throw new ValidationError(`${field} must be given once, as text`, field);
    return value;
  }

  router.get('/', (req, res) => {
    const search = singleQueryValue(req.query, 'search', '');
    const category = singleQueryValue(req.query, 'category', '');
    const sort = singleQueryValue(req.query, 'sort', 'name');
    // Object.hasOwn, not SORTS[sort]: `sort=constructor` would otherwise find an inherited property.
    if (!Object.hasOwn(SORTS, sort)) {
      throw new ValidationError(`sort must be one of ${Object.keys(SORTS).join(', ')}`, 'sort');
    }
    if (search.length > 100) throw new ValidationError('search is too long', 'search');
    // Parameterised query: user input never ends up in the SQL text.
    const rows = db
      .prepare(
        `SELECT * FROM products
         WHERE (? = '' OR name LIKE '%' || ? || '%' OR description LIKE '%' || ? || '%')
           AND (? = '' OR category = ?)
         ORDER BY ${SORTS[sort]}`,
      )
      .all(search, search, search, category, category);
    res.json({ items: rows.map(toDto), total: rows.length });
  });

  router.get('/categories', (req, res) => {
    const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
    res.json(rows.map((r) => r.category));
  });

  router.get('/:id', (req, res) => {
    const id = requirePositiveInt(req.params.id, 'id', { max: Number.MAX_SAFE_INTEGER });
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    return res.json(toDto(row));
  });

  router.patch('/:id/stock', authenticateUser, requireAdmin, (req, res) => {
    const id = requirePositiveInt(req.params.id, 'id', { max: Number.MAX_SAFE_INTEGER });
    const stock = Number(req.body?.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) {
      throw new ValidationError('stock must be an integer between 0 and 100000', 'stock');
    }
    const result = db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
    return res.json(toDto(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
  });

  return router;
};

module.exports.toDto = toDto;
