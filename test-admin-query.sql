-- Test what the admin user can see directly in SQL
-- Replace 'd3ee65ee-2389-4933-abfb-d69cc0682059' with the admin user ID

-- Set the admin user context and try to query
SET LOCAL ROLE postgres;

-- Try to query as the admin user
SELECT * FROM orders LIMIT 5;

-- Check if there are any views named orders
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'orders' 
AND table_schema IN ('public', 'information_schema');

-- Check if there are any RLS policies still active
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'orders';

-- Check RLS status on orders table
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'orders';
