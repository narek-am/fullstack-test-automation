-- Emails are stored lower-case and trimmed, otherwise login lookups miss users.
SELECT id, email
FROM users
WHERE email <> LOWER(TRIM(email))
   OR email NOT LIKE '%_@_%._%';
