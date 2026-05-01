-- DIAGNOSTIC SCRIPT - Check what's actually in the database

-- 1. Check if user exists in auth.users
SELECT id, email, created_at FROM auth.users WHERE email = 'mtudayo@gmail.com';

-- 2. Check profiles table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- 3. Check if profile exists and what role it has
SELECT id, email, role FROM profiles 
WHERE email = 'mtudayo@gmail.com';

-- 4. Check if there's a user_id reference instead of id
SELECT * FROM profiles 
WHERE (id = (SELECT id FROM auth.users WHERE email = 'mtudayo@gmail.com')
   OR email = 'mtudayo@gmail.com')
LIMIT 1;

-- 5. Check RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';
