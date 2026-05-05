-- ============================================
-- COMPLETE RLS POLICIES FOR LMS APPLICATION
-- Includes: profiles, groups, programs, courses, 
-- and chat (messages, conversations, participants)
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

CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
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
    AND role IN ('teacher', 'admin', 'super_admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- 2. PROFILES TABLE RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
  -- Users can see their own profile
  id = auth.uid()
  -- Admins/super_admins can see all profiles in their org
  OR (is_admin_or_above() AND organization_id = get_user_org_id())
);

DROP POLICY IF EXISTS "coordinators_read_profiles" ON public.profiles;
CREATE POLICY "coordinators_read_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_admin_or_above() AND organization_id = get_user_org_id());

DROP POLICY IF EXISTS "teachers_read_student_profiles" ON public.profiles;
CREATE POLICY "teachers_read_student_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  get_user_role() = 'teacher'
  AND organization_id = get_user_org_id()
  AND role = 'student'
);

DROP POLICY IF EXISTS "admins_update_student_group" ON public.profiles;
CREATE POLICY "admins_update_student_group"
ON public.profiles FOR UPDATE
TO authenticated
USING (is_admin_or_above() AND organization_id = get_user_org_id() AND role = 'student')
WITH CHECK (is_admin_or_above() AND organization_id = get_user_org_id() AND role = 'student');

DROP POLICY IF EXISTS "teachers_update_student_group" ON public.profiles;
CREATE POLICY "teachers_update_student_group"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'teacher'
  AND organization_id = get_user_org_id()
  AND role = 'student'
  AND (group_id IS NULL OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = profiles.group_id
      AND gm.profile_id = auth.uid()
      AND gm.role = 'teacher'
  ))
)
WITH CHECK (
  get_user_role() = 'teacher'
  AND organization_id = get_user_org_id()
  AND role = 'student'
  AND (group_id IS NULL OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = profiles.group_id
      AND gm.profile_id = auth.uid()
      AND gm.role = 'teacher'
  ))
);

-- ============================================
-- 3. GROUPS TABLE RLS
-- ============================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_groups" ON public.groups;
CREATE POLICY "org_members_read_groups"
ON public.groups FOR SELECT
TO authenticated
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

DROP POLICY IF EXISTS "teacher_create_groups" ON public.groups;
CREATE POLICY "teacher_create_groups"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id()
  AND is_teacher_or_above()
);

DROP POLICY IF EXISTS "teacher_update_own_groups" ON public.groups;
CREATE POLICY "teacher_update_own_groups"
ON public.groups FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_org_id()
  AND (is_admin_or_above() OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = groups.id
      AND profile_id = auth.uid()
      AND role = 'teacher'
  ))
)
WITH CHECK (
  organization_id = get_user_org_id()
  AND (is_admin_or_above() OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = groups.id
      AND profile_id = auth.uid()
      AND role = 'teacher'
  ))
);

DROP POLICY IF EXISTS "coordinator_delete_groups" ON public.groups;
CREATE POLICY "coordinator_delete_groups"
ON public.groups FOR DELETE
TO authenticated
USING (organization_id = get_user_org_id() AND is_admin_or_above());

-- ============================================
-- 4. PROGRAMS TABLE RLS
-- ============================================

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_programs" ON public.programs;
CREATE POLICY "org_members_read_programs"
ON public.programs FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "coordinator_manage_programs" ON public.programs;
CREATE POLICY "coordinator_manage_programs"
ON public.programs FOR ALL
TO authenticated
USING (organization_id = get_user_org_id() AND is_admin_or_above())
WITH CHECK (organization_id = get_user_org_id() AND is_admin_or_above());

-- ============================================
-- 5. COURSES TABLE RLS
-- ============================================

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_courses" ON public.courses;
CREATE POLICY "org_members_read_courses"
ON public.courses FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "admins_manage_courses" ON public.courses;
CREATE POLICY "admins_manage_courses"
ON public.courses FOR ALL
TO authenticated
USING (organization_id = get_user_org_id() AND is_admin_or_above())
WITH CHECK (organization_id = get_user_org_id() AND is_admin_or_above());

-- ============================================
-- 6. MESSAGES TABLE RLS (CHAT)
-- ============================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_messages_in_conversations" ON public.messages;
CREATE POLICY "users_read_messages_in_conversations"
ON public.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = messages.conversation_id
    AND profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "users_insert_messages_in_conversations" ON public.messages;
CREATE POLICY "users_insert_messages_in_conversations"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = messages.conversation_id
    AND profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "users_update_own_messages" ON public.messages;
CREATE POLICY "users_update_own_messages"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_messages" ON public.messages;
CREATE POLICY "users_delete_own_messages"
ON public.messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- ============================================
-- 7. CONVERSATIONS TABLE RLS (CHAT)
-- ============================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_conversations" ON public.conversations;
CREATE POLICY "users_read_conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conversations.id
    AND profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "users_create_conversations" ON public.conversations;
CREATE POLICY "users_create_conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "users_update_conversations" ON public.conversations;
CREATE POLICY "users_update_conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conversations.id
    AND profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conversations.id
    AND profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "users_delete_conversations" ON public.conversations;
CREATE POLICY "users_delete_conversations"
ON public.conversations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conversations.id
    AND profile_id = auth.uid()
  )
);

-- ============================================
-- 8. CONVERSATION_PARTICIPANTS TABLE RLS (CHAT)
-- ============================================

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_conversation_participants" ON public.conversation_participants;
CREATE POLICY "users_read_conversation_participants"
ON public.conversation_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants AS cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
    AND cp.profile_id = auth.uid()
  )
  OR profile_id = auth.uid()
);

DROP POLICY IF EXISTS "users_insert_conversation_participants" ON public.conversation_participants;
CREATE POLICY "users_insert_conversation_participants"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND organization_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "users_update_conversation_participants" ON public.conversation_participants;
CREATE POLICY "users_update_conversation_participants"
ON public.conversation_participants FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_conversation_participants" ON public.conversation_participants;
CREATE POLICY "users_delete_conversation_participants"
ON public.conversation_participants FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

-- ============================================
-- 9. PROGRAM_TEACHERS TABLE RLS
-- ============================================

-- Note: Ensure program_teachers table exists first
-- See supabase_programs_relations.sql

ALTER TABLE IF EXISTS public.program_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coordinator_manage_program_teachers" ON public.program_teachers;
CREATE POLICY "coordinator_manage_program_teachers" ON public.program_teachers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = program_teachers.program_id
      AND p.organization_id = get_user_org_id()
      AND is_admin_or_above()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = program_teachers.program_id
      AND p.organization_id = get_user_org_id()
      AND is_admin_or_above()
  ));

-- ============================================
-- 10. PROGRAM_STUDENTS TABLE RLS
-- ============================================

ALTER TABLE IF EXISTS public.program_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coordinator_manage_program_students" ON public.program_students;
CREATE POLICY "coordinator_manage_program_students" ON public.program_students
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = program_students.program_id
      AND p.organization_id = get_user_org_id()
      AND is_admin_or_above()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = program_students.program_id
      AND p.organization_id = get_user_org_id()
      AND is_admin_or_above()
  ));

-- ============================================
-- 11. SUCCESS MESSAGE
-- ============================================

SELECT '✅ All RLS policies applied successfully!' as status,
  'Tables with RLS enabled: profiles, groups, programs, courses, messages, conversations, conversation_participants, program_teachers, program_students' as details;
