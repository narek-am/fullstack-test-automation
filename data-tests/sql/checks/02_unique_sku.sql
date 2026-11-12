-- SKUs identify products in other systems, so they must be unique (case-insensitive).
SELECT UPPER(sku) AS sku, COUNT(*) AS copies
FROM products
GROUP BY UPPER(sku)
HAVING COUNT(*) > 1;
