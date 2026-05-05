-- RLS Policies for profiles table - group_id assignment
-- Run this in the Supabase SQL Editor

-- First, enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to check if user is admin or above
CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to check if user is a teacher of a specific group
CREATE OR REPLACE FUNCTION is_teacher_of_group(group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = $1 
    AND profile_id = auth.uid() 
    AND role = 'teacher'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Policy: Allow admins and super_admins to UPDATE group_id for any profile in their organization
CREATE POLICY "Admins can update group_id in their organization"
  ON profiles
  FOR UPDATE
  USING (
    is_admin_or_above() 
    AND organization_id = get_user_org_id()
  )
  WITH CHECK (
    is_admin_or_above() 
    AND organization_id = get_user_org_id()
  );

-- Policy: Allow teachers to UPDATE group_id for students in groups they teach
-- (Optional - if you want teachers to also manage group assignments)
CREATE POLICY "Teachers can update group_id for their students"
  ON profiles
  FOR UPDATE
  USING (
    get_user_role() = 'teacher'
    AND role = 'student'
    AND organization_id = get_user_org_id()
    AND (
      -- Student has no group yet, or is in a group taught by this teacher
      group_id IS NULL 
      OR is_teacher_of_group(group_id)
    )
  )
  WITH CHECK (
    get_user_role() = 'teacher'
    AND role = 'student'
    AND organization_id = get_user_org_id()
    AND (
      group_id IS NULL 
      OR is_teacher_of_group(group_id)
    )
  );

-- Ensure SELECT policy exists for profiles (if not already present)
CREATE POLICY IF NOT EXISTS "Users can view profiles in their organization"
  ON profiles
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    OR get_user_role() = 'super_admin'
  );
