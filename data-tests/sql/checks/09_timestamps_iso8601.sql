-- created_at must be a UTC ISO-8601 timestamp that is not in the future.
SELECT id, created_at
FROM orders
WHERE created_at NOT GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
   OR created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 minute');
