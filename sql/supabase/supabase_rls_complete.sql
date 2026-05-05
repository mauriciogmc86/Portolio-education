-- ============================================
-- RLS POLICIES FOR LMS - COMPLETE SET
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT LOWER(role) FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_coordinator_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND LOWER(role) IN ('admin', 'super_admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_teacher_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND LOWER(role) IN ('teacher', 'admin', 'super_admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_group_teacher(check_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = check_group_id 
    AND profile_id = auth.uid() 
    AND LOWER(role) = 'teacher'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- 2. RLS FOR PROFILES TABLE (ALL OPERATIONS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can read their own profile (this fixes useAuth hook)
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

-- SELECT: Coordinators can read all profiles in their organization
DROP POLICY IF EXISTS "coordinators_read_profiles_org" ON public.profiles;
CREATE POLICY "coordinators_read_profiles_org"
ON public.profiles FOR SELECT TO authenticated
USING (
  is_coordinator_or_above()
  AND organization_id = get_user_org_id()
);

-- SELECT: Teachers can read their own profile and students in their groups
DROP POLICY IF EXISTS "teachers_read_profiles" ON public.profiles;
CREATE POLICY "teachers_read_profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  get_user_role() = 'teacher'
  AND organization_id = get_user_org_id()
  AND (
    id = auth.uid() -- own profile
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

-- UPDATE: Admins can update student group assignments
DROP POLICY IF EXISTS "admins_update_student_group" ON public.profiles;
CREATE POLICY "admins_update_student_group"
ON public.profiles FOR UPDATE TO authenticated
USING (
  is_coordinator_or_above()
  AND organization_id = get_user_org_id()
  AND LOWER(role) = 'student'
)
WITH CHECK (
  is_coordinator_or_above()
  AND organization_id = get_user_org_id()
  AND LOWER(role) = 'student'
);

-- UPDATE: Teachers can update group_id for their students
DROP POLICY IF EXISTS "teachers_update_student_group" ON public.profiles;
CREATE POLICY "teachers_update_student_group"
ON public.profiles FOR UPDATE TO authenticated
USING (
  get_user_role() = 'teacher'
  AND organization_id = get_user_org_id()
  AND LOWER(role) = 'student'
  AND (group_id IS NULL OR is_group_teacher(group_id))
)
WITH CHECK (
  get_user_role() = 'teacher'
  AND organization_id = get_user_org_id()
  AND LOWER(role) = 'student'
  AND (group_id IS NULL OR is_group_teacher(group_id))
);

-- ============================================
-- 3. RLS FOR GROUPS TABLE
-- ============================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Teachers can create groups
DROP POLICY IF EXISTS "teacher_create_groups" ON public.groups;
CREATE POLICY "teacher_create_groups"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_org_id()
  AND is_teacher_or_above()
);

-- Teachers can update their own groups
DROP POLICY IF EXISTS "teacher_update_own_groups" ON public.groups;
CREATE POLICY "teacher_update_own_groups"
ON public.groups FOR UPDATE TO authenticated
USING (
  organization_id = get_user_org_id()
  AND (is_coordinator_or_above() OR is_group_teacher(id))
)
WITH CHECK (
  organization_id = get_user_org_id()
  AND (is_coordinator_or_above() OR is_group_teacher(id))
);

-- Coordinators can delete groups
DROP POLICY IF EXISTS "coordinator_delete_groups" ON public.groups;
CREATE POLICY "coordinator_delete_groups"
ON public.groups FOR DELETE TO authenticated
USING (organization_id = get_user_org_id() AND is_coordinator_or_above());

-- Organization members can read groups
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
-- 4. RLS FOR PROGRAMS TABLE
-- ============================================

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Organization members can read programs
DROP POLICY IF EXISTS "org_members_read_programs" ON public.programs;
CREATE POLICY "org_members_read_programs"
ON public.programs FOR SELECT TO authenticated
USING (organization_id = get_user_org_id());

-- Coordinators can manage programs
DROP POLICY IF EXISTS "coordinator_manage_programs" ON public.programs;
CREATE POLICY "coordinator_manage_programs"
ON public.programs FOR ALL TO authenticated
USING (organization_id = get_user_org_id() AND is_coordinator_or_above())
WITH CHECK (organization_id = get_user_org_id() AND is_coordinator_or_above());

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'RLS policies applied successfully for profiles, groups, and programs' as status;
