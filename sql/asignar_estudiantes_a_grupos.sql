-- ============================================
-- ASIGNAR ESTUDIANTES A GRUPOS
-- ============================================
-- EJECUTAR PRIMERO: diagnostic_grupos_estudiantes.sql
-- Luego modificar este script con los IDs reales
-- ============================================

-- ============================================
-- PASO 1: ASIGNAR ESTUDIANTES A GRUPOS (group_members)
-- ============================================
-- REEMPLAZAR 'ESTUDIANTE_UUID' y 'GRUPO_UUID' con los valores reales

INSERT INTO public.group_members (group_id, profile_id, role)
VALUES (
    'GRUPO_UUID'::UUID,
    'ESTUDIANTE_UUID'::UUID,
    'student'
)
ON CONFLICT (group_id, profile_id) DO NOTHING;

-- ============================================
-- PASO 2: OPCIÓN ALTERNATIVA (usando enrollments)
-- ============================================
-- Si prefieres usar la tabla legacy 'enrollments'

INSERT INTO public.enrollments (student_id, group_id, enrolled_at)
SELECT 
    'ESTUDIANTE_UUID'::UUID as student_id,
    'GRUPO_UUID'::UUID as group_id,
    NOW() as enrolled_at
WHERE NOT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.student_id = 'ESTUDIANTE_UUID'::UUID
    AND e.group_id = 'GRUPO_UUID'::UUID
);

-- ============================================
-- PASO 3: ASIGNACIÓN MASIVA (todos los estudiantes a un grupo)
-- ============================================
-- Úsalo con precaución - asigna TODOS los estudiantes a un grupo específico

/*
 INSERT INTO public.group_members (group_id, profile_id, role, created_at)
SELECT 
    'GRUPO_UUID'::UUID as group_id,
    p.id as profile_id,
     'student' as role
FROM profiles p
WHERE p.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM group_members gm 
    WHERE gm.profile_id = p.id 
    AND gm.group_id = 'GRUPO_UUID'::UUID
  )
ON CONFLICT (group_id, profile_id) DO NOTHING;
*/

-- ============================================
-- VERIFICAR ASIGNACIONES
-- ============================================
SELECT 
    'ASIGNACIONES REALIZADAS' as tipo,
    p.name as estudiante,
    p.email,
    g.name as grupo,
    gm.role as rol_en_grupo,
    gm.created_at
FROM group_members gm
JOIN profiles p ON p.id = gm.profile_id
JOIN groups g ON g.id = gm.group_id
WHERE gm.group_id = 'GRUPO_UUID'::UUID;

SELECT '✅ Asignaciones completadas' as status;
