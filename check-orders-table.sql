-- Check if there are multiple orders tables or views
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name LIKE '%order%' 
AND table_schema = 'public';

-- Check the actual orders table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Count orders in the orders table
SELECT COUNT(*) as order_count FROM orders;

-- Get sample order data
SELECT * FROM orders LIMIT 5;
