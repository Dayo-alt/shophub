-- Fix admin RLS policy to allow admins to view all orders

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders via kv_store" ON orders;

-- Create admin policy using kv_store (this is the working approach from other policies)
CREATE POLICY "Admins can manage all orders" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM kv_store_955d7104 
      WHERE key = 'user:' || auth.uid()::text 
      AND value->>'role' = 'admin'
    )
  );
