-- Create submissions table for assignment submissions
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  grade NUMERIC,
  feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "students_create_submissions" ON submissions;
CREATE POLICY "students_create_submissions"
ON submissions FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "users_read_submissions" ON submissions;
CREATE POLICY "users_read_submissions"
ON submissions FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "users_update_submissions" ON submissions;
CREATE POLICY "users_update_submissions"
ON submissions FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "users_delete_submissions" ON submissions;
CREATE POLICY "users_delete_submissions"
ON submissions FOR DELETE TO authenticated
USING (true);

SELECT '✅ Submissions table created successfully!' as status;

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_group_id ON enrollments(group_id);

-- Enable RLS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "users_read_enrollments" ON enrollments;
CREATE POLICY "users_read_enrollments"
ON enrollments FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "users_create_enrollments" ON enrollments;
CREATE POLICY "users_create_enrollments"
ON enrollments FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "users_delete_enrollments" ON enrollments;
CREATE POLICY "users_delete_enrollments"
ON enrollments FOR DELETE TO authenticated
USING (true);

SELECT '✅ Enrollments table created successfully!' as status;