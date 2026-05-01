-- SIMPLE CHECKS - Run these one at a time and share results

-- Query 1: Does the user exist?
SELECT id, email FROM auth.users WHERE email = 'mtudayo@gmail.com';

-- Query 2: Does the profile exist?
SELECT id, email, role, name FROM profiles WHERE email = 'mtudayo@gmail.com';

-- Query 3: Get the user_id from auth and check profiles by that ID
SELECT p.id, p.email, p.role, p.name 
FROM profiles p
WHERE p.id = (SELECT id FROM auth.users WHERE email = 'mtudayo@gmail.com' LIMIT 1);
