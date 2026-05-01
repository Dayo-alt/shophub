# Deployment Guide

## Current Status
- ✅ Frontend built successfully
- ✅ Backend already deployed on Supabase Cloud
- ✅ Ready for static hosting deployment

## Backend (Already Deployed)
- **Supabase Project**: https://azelpjscwzkwioxoquft.supabase.co
- **Edge Functions**: Deployed and running
- **Database**: Configured and ready

## Frontend Deployment Options

### Option 1: Netlify (Recommended)
1. **Create Account**: https://netlify.com
2. **Drag & Drop**: Drag the `dist/` folder to Netlify
3. **Or CLI**: 
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

### Option 2: Vercel
1. **Create Account**: https://vercel.com
2. **Connect GitHub** or drag `dist/` folder
3. **Framework Preset**: Vite

### Option 3: GitHub Pages
```bash
# Add to package.json
"homepage": "https://[username].github.io/[repo-name]"

# Build and deploy
npm run build
# Deploy dist/ folder to gh-pages branch
```

## Environment Variables
Set these in your hosting provider:

**Required for Payments:**
- `VITE_PAYSTACK_PUBLIC_KEY`: Your PayStack public key
- `VITE_STRIPE_PUBLIC_KEY`: Your Stripe public key

**Already Configured:**
- `VITE_SUPABASE_URL`: https://azelpjscwzkwioxoquft.supabase.co
- `VITE_SUPABASE_ANON_KEY`: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ZWxwanNjd3prd2lveG9xdWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTk4NDMsImV4cCI6MjA3OTE5NTg0M30.MJnIF_BAxo1yD4gJOCVqmMzs8vxhHQp6VhnnABYNUbw

## Post-Deployment Setup
1. **Configure Payment Providers**:
   - Get PayStack keys: https://dashboard.paystack.co
   - Get Stripe keys: https://dashboard.stripe.com

2. **Test the Application**:
   - User registration/login
   - Product creation (seller)
   - Order processing
   - Payment flow

3. **Monitor Backend**:
   - Supabase Dashboard: https://supabase.com/dashboard/project/azelpjscwzkwioxoquft

## Build Commands
```bash
# Development
npm run dev

# Production Build
npm run build

# Preview Build
npm run preview
```

## Notes
- The backend runs on Supabase Edge Functions (serverless)
- No server maintenance required
- Automatic scaling and SSL included
- Database backups handled by Supabase
