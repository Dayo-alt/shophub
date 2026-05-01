-- Grant admin role to mtudayo@gmail.com
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'mtudayo@gmail.com'
);

-- Verify the update
SELECT id, email, role FROM profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'mtudayo@gmail.com');
