-- ============================================
-- RLS POLICIES FOR PROFILES AND GROUPS TABLES (SELECT)
-- Run this in Supabase SQL Editor after the main policies
-- ============================================

-- Enable RLS on profiles and groups (already enabled in main script)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. PROFILE SELECT POLICIES
-- ============================================

-- Policy: Users can read their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

-- Policy: Coordinators and Super Admins can read all profiles in their organization
DROP POLICY IF EXISTS "coordinators_read_profiles_org" ON public.profiles;
CREATE POLICY "coordinators_read_profiles_org"
ON public.profiles FOR SELECT TO authenticated
USING (
  is_coordinator_or_above()
  AND organization_id = get_user_org_id()
);

-- Policy: Teachers can read profiles of students in their groups
DROP POLICY IF EXISTS "teachers_read_profiles" ON public.profiles;
CREATE POLICY "teachers_read_profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  get_user_role() = 'teacher'
  AND organization_id = get_user_org_id()
  AND (
    id = auth.uid() -- their own profile
    OR (
      LOWER(role) = 'student'
      AND group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = profiles.group_id
          AND gm.profile_id = auth.uid()
      )
    )
  )
);

-- Policy: Teachers can read their own profile and student profiles in their groups
DROP POLICY IF EXISTS "teachers_read_profiles" ON public.profiles;
CREATE POLICY "teachers_read_profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  get_user_role() = 'teacher'
  AND organization_id = get_user_org_id()
  AND (
    id = auth.uid() -- own profile
    OR (
      role = 'student'
      AND group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = profiles.group_id
          AND gm.profile_id = auth.uid()
      )
    )
  )
);

-- ============================================
-- 2. GROUPS SELECT POLICIES
-- ============================================

-- Policy: Organization members can read groups from their organization
-- Teachers only see their groups, admins see all
DROP POLICY IF EXISTS "org_members_read_groups" ON public.groups;
CREATE POLICY "org_members_read_groups"
ON public.groups FOR SELECT TO authenticated
USING (
  -- Teachers only see groups where they are the teacher
  (get_user_role() = 'teacher' AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = groups.id
      AND gm.profile_id = auth.uid()
      AND LOWER(gm.role) = 'teacher'
  ))
  -- Admins/coordinators see all groups in their org
  OR (is_coordinator_or_above() AND organization_id = get_user_org_id())
  -- Students see groups where they are members
  OR (get_user_role() = 'student' AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = groups.id
      AND gm.profile_id = auth.uid()
      AND LOWER(gm.role) = 'student'
  ))
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.group_id = groups.id
      AND e.student_id = auth.uid()
  )
);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'RLS SELECT policies applied successfully for profiles and groups' as status;
