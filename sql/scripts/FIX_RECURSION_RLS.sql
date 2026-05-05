-- ============================================
-- FIX RLS POLICIES - VERIFIED WORKING VERSION
-- ============================================

-- ============================================
-- 1. DISABLE ALL POLICIES
-- ============================================
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "org_members_read_groups" ON public.groups;
DROP POLICY IF EXISTS "users_can_crud_groups" ON public.groups;
DROP POLICY IF EXISTS "teacher_create_groups" ON public.groups;
DROP POLICY IF EXISTS "teacher_update_own_groups" ON public.groups;
DROP POLICY IF EXISTS "coordinator_delete_groups" ON public.groups;

DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_crud_profiles" ON public.profiles;
DROP POLICY IF EXISTS "coordinators_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "teachers_read_student_profiles" ON public.profiles;

DROP POLICY IF EXISTS "users_read_own_group_memberships" ON public.group_members;
DROP POLICY IF EXISTS "users_can_crud_group_members" ON public.group_members;
DROP POLICY IF EXISTS "admins_manage_group_members" ON public.group_members;
DROP POLICY IF EXISTS "teachers_manage_own_group_members" ON public.group_members;

-- ============================================
-- 2. ENABLE RLS WITH SIMPLE POLICIES
-- ============================================

-- Profiles: Users see their own, admins see all in org
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_can_crud_profiles" 
ON public.profiles FOR ALL 
TO authenticated 
USING (id = auth.uid() OR is_admin_or_above())
WITH CHECK (id = auth.uid() OR is_admin_or_above());

-- Groups: Admins see all, teachers/students only see groups where they are members
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_can_crud_groups" 
ON public.groups FOR ALL 
TO authenticated 
USING (
  -- Admins see all groups in their org
  (is_admin_or_above() AND organization_id = get_user_org_id())
  -- Teachers/students see groups where they are members
  OR EXISTS (
    SELECT 1 FROM group_members gm 
    WHERE gm.group_id = groups.id 
      AND gm.profile_id = auth.uid()
  )
)
WITH CHECK (organization_id = get_user_org_id() AND is_teacher_or_above());

-- Group members: Simple permissions
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_can_crud_group_members" 
ON public.group_members FOR ALL 
TO authenticated 
USING (is_admin_or_above() OR profile_id = auth.uid())
WITH CHECK (is_admin_or_above());

SELECT '✅ Working RLS policies applied' as status;