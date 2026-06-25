-- Check if the current admin user has the correct role in kv_store
-- Run this to see what's in the kv_store for your admin user

-- First, let's see all entries in kv_store
SELECT * FROM kv_store_955d7104;

-- If your admin user doesn't have an entry, you need to add it
-- Replace 'YOUR_ADMIN_USER_ID' with your actual admin user ID (from auth.users table)

-- Example to add admin role:
-- INSERT INTO kv_store_955d7104 (key, value)
-- VALUES ('user:YOUR_ADMIN_USER_ID', '{"role": "admin"}'::jsonb);

-- Or update if it exists:
-- UPDATE kv_store_955d7104 
-- SET value = jsonb_set(value, '{role}', '"admin"')
-- WHERE key = 'user:YOUR_ADMIN_USER_ID';
