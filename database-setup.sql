-- Create seller_metrics table for seller analytics
CREATE TABLE seller_metrics (
  seller_id TEXT PRIMARY KEY,
  shipping_speed DECIMAL(3, 2) DEFAULT 0.00,
  quality_score DECIMAL(3, 2) DEFAULT 0.00,
  customer_rating DECIMAL(3, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE seller_metrics ENABLE ROW LEVEL SECURITY;

-- Create policy for sellers to view their own metrics
CREATE POLICY "Sellers can view own metrics" ON seller_metrics
  FOR SELECT USING (auth.uid() = seller_id);

-- Create policy for sellers to update their own metrics  
CREATE POLICY "Sellers can update own metrics" ON seller_metrics
  FOR UPDATE USING (auth.uid() = seller_id);

-- Create policy for admins to manage all metrics
CREATE POLICY "Admins can manage all metrics" ON seller_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM kv_store_955d7104 
      WHERE key = 'user:' || auth.uid() 
      AND value->>'role' = 'admin'
    )
  );
