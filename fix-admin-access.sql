-- First, get the user ID
SELECT id, email FROM auth.users WHERE email = 'mtudayo@gmail.com';

-- Insert or update profile with admin role
INSERT INTO profiles (id, email, role, name, created_at, updated_at)
SELECT 
  id,
  email,
  'admin',
  email,
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'mtudayo@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  updated_at = NOW();

-- Verify the result
SELECT id, email, role FROM profiles 
WHERE email = 'mtudayo@gmail.com';
