-- Stored order total = sum of lines + shipping (free from $50.00, otherwise $4.99).
WITH lines AS (
  SELECT order_id, SUM(quantity * unit_price_cents) AS subtotal
  FROM order_items
  GROUP BY order_id
)
SELECT o.id, o.total_cents, l.subtotal,
       l.subtotal + CASE WHEN l.subtotal >= 5000 THEN 0 ELSE 499 END AS expected_total
FROM orders o
JOIN lines l ON l.order_id = o.id
WHERE o.total_cents <> l.subtotal + CASE WHEN l.subtotal >= 5000 THEN 0 ELSE 499 END;
