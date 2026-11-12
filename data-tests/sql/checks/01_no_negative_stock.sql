-- Stock can never go below zero, even under concurrent checkouts.
SELECT id, sku, stock
FROM products
WHERE stock < 0;
