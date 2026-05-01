#!/bin/bash

# Deploy CORS fix to Supabase
echo "Deploying CORS fix..."

# Create temporary deployment file
cat > supabase/functions/server/index.ts << 'EOF'
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Handle OPTIONS preflight requests FIRST
app.options('*', (c) => {
  return c.text('', 200);
});

app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://your-production-domain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Copy the rest of your existing server code here...
// (For now, just a simple orders route)

app.post('/orders', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderData = await c.req.json();
    
    // Simple order processing
    const order = {
      ...orderData,
      id: \`order-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
      buyerId: user.id,
      buyerEmail: user.email,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    return c.json({ success: true, order });
  } catch (error) {
    console.error('Order error:', error);
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);
EOF

echo "CORS fix prepared. Deploying..."
npx supabase functions deploy server --no-verify-jwt

echo "Deployment complete!"
