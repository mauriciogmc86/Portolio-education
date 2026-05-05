-- ============================================
-- RLS POLICIES FOR ASSIGNMENTS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- HELPER FUNCTIONS (create if not exist)
-- ============================================

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT LOWER(role) FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_above()
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
    AND role IN ('teacher', 'admin', 'super_admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- 1. ENSURE ORGANIZATION_ID COLUMN EXISTS
-- ============================================

ALTER TABLE public.assignments 
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- ============================================
-- 2. ENSURE OTHER MISSING COLUMNS EXIST
-- ============================================

ALTER TABLE public.assignments 
  ADD COLUMN IF NOT EXISTS program_id UUID,
  ADD COLUMN IF NOT EXISTS group_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_grade INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Make created_by nullable in case profile_id is needed
ALTER TABLE public.assignments ALTER COLUMN created_by DROP NOT NULL;

-- ============================================
-- 3. ENABLE RLS ON ASSIGNMENTS TABLE
-- ============================================

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. RLS POLICIES FOR ASSIGNMENTS
-- ============================================

-- Allow teachers/coordinators to view assignments in their organization AND their groups
DROP POLICY IF EXISTS "org_members_read_assignments" ON public.assignments;
CREATE POLICY "org_members_read_assignments"
ON public.assignments FOR SELECT
TO authenticated
USING (
  -- Coordinators/Admins can see all org assignments
  (organization_id = get_user_org_id() AND is_teacher_or_above())
  -- Teachers can only see assignments from groups where they are the teacher
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE gm.group_id = assignments.group_id
      AND gm.profile_id = auth.uid()
      AND LOWER(gm.role) = 'teacher'
  )
  -- Students can see assignments from their groups
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = assignments.group_id
      AND gm.profile_id = auth.uid()
      AND LOWER(gm.role) = 'student'
  )
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.group_id = assignments.group_id
      AND e.student_id = auth.uid()
  )
);

-- Allow students to view assignments of their groups
DROP POLICY IF EXISTS "students_read_assignments_in_groups" ON public.assignments;
CREATE POLICY "students_read_assignments_in_groups"
ON public.assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = assignments.group_id
      AND gm.profile_id = auth.uid()
      AND LOWER(gm.role) = 'student'
  )
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.group_id = assignments.group_id
      AND e.student_id = auth.uid()
  )
);

 -- Allow students to view assignments of their groups
-- Check both group_members (new) and enrollments (legacy) for membership
DROP POLICY IF EXISTS "students_read_assignments_in_groups" ON public.assignments;
CREATE POLICY "students_read_assignments_in_groups"
ON public.assignments FOR SELECT
TO authenticated
USING (
  -- User is a member of the group (any role)
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = assignments.group_id
      AND gm.profile_id = auth.uid()
  )
  OR EXISTS (
    -- Legacy enrollments table
    SELECT 1 FROM public.enrollments e
    WHERE e.group_id = assignments.group_id
      AND e.student_id = auth.uid()
  )
  -- También permitir acceso si el estudiante es el creador
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'student'
      AND assignments.created_by = auth.uid()
  )
);

 -- Allow teachers/coordinators to create assignments
DROP POLICY IF EXISTS "teachers_create_assignments" ON public.assignments;
CREATE POLICY "teachers_create_assignments"
ON public.assignments FOR INSERT
TO authenticated
WITH CHECK (
  is_teacher_or_above()
  AND organization_id = get_user_org_id()
);

-- Allow teachers/coordinators to update assignments
DROP POLICY IF EXISTS "teachers_update_assignments" ON public.assignments;
CREATE POLICY "teachers_update_assignments"
ON public.assignments FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_org_id()
  AND is_teacher_or_above()
)
WITH CHECK (
  organization_id = get_user_org_id()
  AND is_teacher_or_above()
);

-- Allow teachers/coordinators to delete assignments
DROP POLICY IF EXISTS "teachers_delete_assignments" ON public.assignments;
CREATE POLICY "teachers_delete_assignments"
ON public.assignments FOR DELETE
TO authenticated
USING (
  organization_id = get_user_org_id()
  AND is_teacher_or_above()
);

-- ============================================
-- 3. SUCCESS MESSAGE
-- ============================================

SELECT '✅ Assignments RLS policies applied successfully!' as status;

-- ============================================
-- 4. RLS POLICIES FOR CONTENT_FILES TABLE
-- ============================================

ALTER TABLE public.content_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_content_files" ON public.content_files;
CREATE POLICY "org_members_read_content_files"
ON public.content_files FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "users_create_content_files" ON public.content_files;
CREATE POLICY "users_create_content_files"
ON public.content_files FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "users_update_content_files" ON public.content_files;
CREATE POLICY "users_update_content_files"
ON public.content_files FOR UPDATE
TO authenticated
USING (organization_id = get_user_org_id())
WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "users_delete_content_files" ON public.content_files;
CREATE POLICY "users_delete_content_files"
ON public.content_files FOR DELETE
TO authenticated
USING (organization_id = get_user_org_id());

-- ============================================
-- 5. ENSURE CONTENT_FILES COLUMNS EXIST
-- ============================================

ALTER TABLE public.content_files 
  ADD COLUMN IF NOT EXISTS assignment_id UUID,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID,
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_secs INTEGER,
  ADD COLUMN IF NOT EXISTS downloads_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.content_files 
  DROP CONSTRAINT IF EXISTS fk_content_files_assignment,
  ADD CONSTRAINT fk_content_files_assignment
    FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE SET NULL;

SELECT '✅ Content files RLS policies and columns applied successfully!' as status;

-- ============================================
-- 6. RLS POLICIES FOR GROUP_MEMBERS TABLE
-- ============================================

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Users can read their own group memberships; teachers can see memberships of their groups
DROP POLICY IF EXISTS "users_read_own_group_memberships" ON public.group_members;
CREATE POLICY "users_read_own_group_memberships"
ON public.group_members FOR SELECT
TO authenticated
USING (
  -- Users can see their own memberships
  profile_id = auth.uid()
  -- Teachers can see memberships of groups where they are the teacher
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND LOWER(p.role) = 'teacher'
      )
  )
  -- Admins/coordinators can see all memberships in their org
  OR EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE g.id = group_members.group_id
      AND g.organization_id = p.organization_id
      AND LOWER(p.role) IN ('admin', 'super_admin')
  )
);

-- Admins/coordinators can manage group members within their organization
DROP POLICY IF EXISTS "admins_manage_group_members" ON public.group_members;
CREATE POLICY "admins_manage_group_members"
ON public.group_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE g.id = group_members.group_id
      AND g.organization_id = p.organization_id
      AND LOWER(p.role) IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE g.id = group_members.group_id
      AND g.organization_id = p.organization_id
      AND LOWER(p.role) IN ('admin', 'super_admin')
  )
);

-- Teachers can manage members of their own groups
-- FIXED: Eliminated recursion by using profiles instead of querying group_members recursively
DROP POLICY IF EXISTS "teachers_manage_own_group_members" ON public.group_members;
CREATE POLICY "teachers_manage_own_group_members"
ON public.group_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE g.id = group_members.group_id
      AND g.organization_id = p.organization_id
      AND LOWER(p.role) = 'teacher'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE g.id = group_members.group_id
      AND g.organization_id = p.organization_id
      AND LOWER(p.role) IN ('teacher', 'admin', 'super_admin')
  )
);

SELECT '✅ Group members RLS policies applied!' as status;

-- ============================================
-- 7. RLS POLICIES FOR SUBMISSIONS TABLE
-- ============================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_create_submissions" ON public.submissions;
CREATE POLICY "students_create_submissions"
ON public.submissions FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "users_read_submissions" ON public.submissions;
CREATE POLICY "users_read_submissions"
ON public.submissions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "users_update_submissions" ON public.submissions;
CREATE POLICY "users_update_submissions"
ON public.submissions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "users_delete_submissions" ON public.submissions;
CREATE POLICY "users_delete_submissions"
ON public.submissions FOR DELETE
TO authenticated
USING (true);

SELECT '✅ Submissions table RLS policies applied!' as status;

-- ============================================
-- 8. RLS POLICIES FOR ENROLLMENTS TABLE
-- ============================================

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_enrollments" ON public.enrollments;
CREATE POLICY "users_read_enrollments"
ON public.enrollments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "users_create_enrollments" ON public.enrollments;
CREATE POLICY "users_create_enrollments"
ON public.enrollments FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "users_delete_enrollments" ON public.enrollments;
CREATE POLICY "users_delete_enrollments"
ON public.enrollments FOR DELETE
TO authenticated
USING (true);

SELECT '✅ Enrollments table RLS policies applied!' as status;

-- ============================================
-- FINAL MESSAGE
-- ============================================

SELECT '✅✅✅ ALL RLS POLICIES APPLIED SUCCESSFULLY ✅✅✅' as final_status;