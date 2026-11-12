-- Passwords must be stored as salt:hash (32 + 64 hex chars), never in plain text.
SELECT id, email
FROM users
WHERE LENGTH(password_hash) <> 97
   OR INSTR(password_hash, ':') <> 33;
