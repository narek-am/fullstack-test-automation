-- Cart quantities must stay within 1..99 and must not exceed current stock.
SELECT c.user_id, c.product_id, c.quantity, p.stock
FROM cart_items c
JOIN products p ON p.id = c.product_id
WHERE c.quantity < 1 OR c.quantity > 99 OR c.quantity > p.stock;
