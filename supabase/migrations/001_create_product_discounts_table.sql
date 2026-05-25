-- Create product_discounts table for seller discount management
CREATE TABLE IF NOT EXISTS product_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_price NUMERIC NOT NULL,
  discount_price NUMERIC NOT NULL,
  discount_percent NUMERIC GENERATED ALWAYS AS (
    ROUND(((original_price - discount_price) / original_price * 100)::NUMERIC, 2)
  ) STORED,
  active_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure discount price is less than original
  CHECK (discount_price < original_price)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_product_discounts_product_id 
  ON product_discounts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_discounts_seller_id 
  ON product_discounts(seller_id);
CREATE INDEX IF NOT EXISTS idx_product_discounts_active_end_time 
  ON product_discounts(active_end_time);
CREATE INDEX IF NOT EXISTS idx_product_discounts_product_active 
  ON product_discounts(product_id, is_active)
  WHERE is_active = TRUE;

-- Create user_discount_sessions table for tracking active discounts per user
CREATE TABLE IF NOT EXISTS user_discount_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  guest_email TEXT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_id UUID NOT NULL REFERENCES product_discounts(id) ON DELETE CASCADE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Either user_id or guest_email should be set
  CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL)
);

-- Create indexes for user discount sessions
CREATE INDEX IF NOT EXISTS idx_user_discount_sessions_user_id 
  ON user_discount_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_discount_sessions_guest_email 
  ON user_discount_sessions(guest_email);
CREATE INDEX IF NOT EXISTS idx_user_discount_sessions_product_id 
  ON user_discount_sessions(product_id);
CREATE INDEX IF NOT EXISTS idx_user_discount_sessions_expires_at 
  ON user_discount_sessions(expires_at);

-- Create user_carts table for persistent cart storage
CREATE TABLE IF NOT EXISTS user_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_items JSONB DEFAULT '[]',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create index on user_carts
CREATE INDEX IF NOT EXISTS idx_user_carts_user_id 
  ON user_carts(user_id);

-- Enable RLS for user_carts
ALTER TABLE user_carts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view/edit their own cart
CREATE POLICY "Users can manage own cart"
ON user_carts
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create view for active discounts (for easier querying)
CREATE OR REPLACE VIEW active_product_discounts AS
SELECT
  pd.id,
  pd.product_id,
  pd.seller_id,
  pd.original_price,
  pd.discount_price,
  pd.discount_percent,
  pd.active_start_time,
  pd.active_end_time,
  pd.created_at
FROM product_discounts AS pd
WHERE pd.is_active = TRUE
  AND NOW() >= pd.active_start_time
  AND NOW() < pd.active_end_time;

-- Enable RLS (Row Level Security) for product_discounts
ALTER TABLE product_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_discount_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Sellers can manage their own discounts" ON product_discounts;
DROP POLICY IF EXISTS "Anyone can view active discounts" ON product_discounts;
DROP POLICY IF EXISTS "Users can view own discount sessions" ON user_discount_sessions;

-- RLS Policy: Sellers can view/edit their own discounts
CREATE POLICY "Sellers can manage their own discounts"
ON product_discounts
FOR ALL
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

-- RLS Policy: Anyone can view active discounts (for display purposes)
CREATE POLICY "Anyone can view active discounts"
ON product_discounts
FOR SELECT
USING (is_active = TRUE AND NOW() < active_end_time);

-- RLS Policy: Users can view their own discount sessions
CREATE POLICY "Users can view own discount sessions"
ON user_discount_sessions
FOR SELECT
USING (user_id = auth.uid() OR guest_email = current_user);
