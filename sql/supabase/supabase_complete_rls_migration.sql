-- ============================================
-- MIGRACIÓN COMPLETA: RLS POLICIES Y TABLAS
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- ============================================
-- 1. CREAR TABLA COURSES SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_courses_organization_id ON courses(organization_id);
CREATE INDEX IF NOT EXISTS idx_courses_group_id ON courses(group_id);

-- ============================================
-- 2. FUNCIONES AUXILIARES PARA RLS
-- ============================================

-- Obtener organization_id del usuario actual
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Obtener rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Verificar si el usuario es admin o superior
CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Verificar si el usuario es profesor de un grupo específico
CREATE OR REPLACE FUNCTION is_teacher_of_group(check_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = check_group_id 
    AND profile_id = auth.uid() 
    AND role = 'teacher'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- 3. RLS PARA TABLA PROFILES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: Usuarios pueden ver perfiles de su organización
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
CREATE POLICY "Users can view profiles in their organization"
  ON profiles
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    OR get_user_role() = 'super_admin'
  );

-- Política para UPDATE group_id: Admins pueden actualizar group_id
DROP POLICY IF EXISTS "Admins can update group_id in their organization" ON profiles;
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

-- Política para UPDATE group_id: Teachers pueden actualizar group_id de sus estudiantes
DROP POLICY IF EXISTS "Teachers can update group_id for their students" ON profiles;
CREATE POLICY "Teachers can update group_id for their students"
  ON profiles
  FOR UPDATE
  USING (
    get_user_role() = 'teacher'
    AND role = 'student'
    AND organization_id = get_user_org_id()
    AND (
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

-- ============================================
-- 4. RLS PARA TABLA GROUPS
-- ============================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Política para SELECT
DROP POLICY IF EXISTS "Users can view groups in their organization" ON groups;
CREATE POLICY "Users can view groups in their organization"
  ON groups
  FOR SELECT
  USING (organization_id = get_user_org_id());

-- Política para INSERT: Admins pueden crear grupos
DROP POLICY IF EXISTS "Admins can create groups" ON groups;
CREATE POLICY "Admins can create groups"
  ON groups
  FOR INSERT
  WITH CHECK (
    is_admin_or_above()
    AND organization_id = get_user_org_id()
  );

-- Política para UPDATE: Admins pueden editar grupos
DROP POLICY IF EXISTS "Admins can update groups" ON groups;
CREATE POLICY "Admins can update groups"
  ON groups
  FOR UPDATE
  USING (
    is_admin_or_above()
    AND organization_id = get_user_org_id()
  )
  WITH CHECK (
    is_admin_or_above()
    AND organization_id = get_user_org_id()
  );

-- Política para DELETE: Admins pueden eliminar grupos
DROP POLICY IF EXISTS "Admins can delete groups" ON groups;
CREATE POLICY "Admins can delete groups"
  ON groups
  FOR DELETE
  USING (
    is_admin_or_above()
    AND organization_id = get_user_org_id()
  );

-- ============================================
-- 5. RLS PARA TABLA COURSES
-- ============================================

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Política para SELECT
DROP POLICY IF EXISTS "Users can view courses in their organization" ON courses;
CREATE POLICY "Users can view courses in their organization"
  ON courses
  FOR SELECT
  USING (organization_id = get_user_org_id());

-- Política para INSERT: Admins pueden crear materias
DROP POLICY IF EXISTS "Admins can create courses" ON courses;
CREATE POLICY "Admins can create courses"
  ON courses
  FOR INSERT
  WITH CHECK (
    is_admin_or_above()
    AND organization_id = get_user_org_id()
  );

-- Política para UPDATE: Admins pueden editar materias
DROP POLICY IF EXISTS "Admins can update courses" ON courses;
CREATE POLICY "Admins can update courses"
  ON courses
  FOR UPDATE
  USING (
    is_admin_or_above()
    AND organization_id = get_user_org_id()
  )
  WITH CHECK (
    is_admin_or_above()
    AND organization_id = get_user_org_id()
  );

-- Política para DELETE: Admins pueden eliminar materias
DROP POLICY IF EXISTS "Admins can delete courses" ON courses;
CREATE POLICY "Admins can delete courses"
  ON courses
  FOR DELETE
  USING (
    is_admin_or_above()
    AND organization_id = get_user_org_id()
  );

-- ============================================
-- 6. TRIGGER PARA UPDATED_AT EN COURSES
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MENSAJE DE ÉXITO
-- ============================================

SELECT 'Migración completada: RLS policies configuradas para profiles, groups y courses' as status;
