-- Migration: create program_teachers and program_students

CREATE TABLE IF NOT EXISTS program_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_teachers_program_id ON program_teachers(program_id);
CREATE INDEX IF NOT EXISTS idx_program_teachers_profile_id ON program_teachers(profile_id);

CREATE TABLE IF NOT EXISTS program_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_students_program_id ON program_students(program_id);
CREATE INDEX IF NOT EXISTS idx_program_students_profile_id ON program_students(profile_id);
