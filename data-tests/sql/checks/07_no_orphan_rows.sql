-- Referential integrity, checked explicitly in case foreign keys were ever disabled.
SELECT 'order_items.order_id' AS reference, oi.order_id AS id
FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL
UNION ALL
SELECT 'order_items.product_id', oi.product_id
FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE p.id IS NULL
UNION ALL
SELECT 'cart_items.user_id', c.user_id
FROM cart_items c LEFT JOIN users u ON u.id = c.user_id WHERE u.id IS NULL
UNION ALL
SELECT 'orders.user_id', o.user_id
FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE u.id IS NULL;
