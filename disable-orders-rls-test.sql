-- Temporarily disable RLS for orders to test if it's a permissions issue
-- This is for testing only - re-enable after confirming the issue

ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- After testing, re-enable with:
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
