-- An order without lines means a checkout half-failed.
SELECT o.id
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id
HAVING COUNT(oi.product_id) = 0;
