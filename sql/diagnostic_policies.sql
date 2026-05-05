-- ============================================
-- DIAGNOSTIC: Check for policy issues
-- ============================================

-- Check if functions exist and work
SELECT 'Testing get_user_org_id:' as test;
SELECT get_user_org_id() as org_id;

SELECT 'Testing is_admin_or_above:' as test;
SELECT is_admin_or_above() as is_admin;

SELECT 'Testing is_teacher_or_above:' as test;
SELECT is_teacher_or_above() as is_teacher;

-- Check if groups table has data
SELECT 'Groups count:' as info;
SELECT COUNT(*) as total_groups FROM groups;

-- Check profiles table
SELECT 'Profiles count:' as info;
SELECT COUNT(*) as total_profiles FROM profiles;