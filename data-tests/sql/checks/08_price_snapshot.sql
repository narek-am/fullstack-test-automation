-- Order lines keep the price paid at checkout. It must be positive and not be
-- higher than 10x the current price (catches cents/dollars mix-ups).
SELECT oi.order_id, oi.product_id, oi.unit_price_cents, p.price_cents
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE oi.unit_price_cents <= 0
   OR oi.unit_price_cents > p.price_cents * 10;
