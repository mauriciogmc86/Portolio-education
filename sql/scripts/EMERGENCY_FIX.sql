-- ============================================
-- EMERGENCY FIX: Disable RLS temporarily for groups
-- ============================================

-- Disable RLS on groups table to fix 500 error
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;

-- Verify it works
SELECT 'Groups accessible:' as status, COUNT(*) as count FROM groups;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

SELECT 'RLS re-enabled. You may get 500 error again.' as warning;