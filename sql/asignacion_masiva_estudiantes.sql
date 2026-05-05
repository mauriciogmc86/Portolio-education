-- ============================================
-- ASIGNACIÓN MASIVA DE ESTUDIANTES A GRUPOS
-- ============================================
-- Este script asigna automáticamente a cada estudiante
-- a un grupo existente en su misma organización
-- 
-- EJECUTAR EN Supabase SQL Editor
-- ============================================

-- PASO 1: Ver estado actual
SELECT '=== ESTADO ACTUAL ===' as status;

SELECT 
  'Estudiantes sin grupo' as categoria,
  COUNT(*) as cantidad
FROM profiles 
WHERE role = 'student'
  AND id NOT IN (SELECT profile_id FROM group_members)
  AND id NOT IN (SELECT student_id FROM enrollments)
UNION ALL
SELECT 
  'Total estudiantes' as categoria,
  COUNT(*) as cantidad
FROM profiles 
WHERE role = 'student'
UNION ALL
SELECT 
  'Total grupos' as categoria,
  COUNT(*) as cantidad
FROM groups
UNION ALL
SELECT 
  'Membresías existentes' as categoria,
  COUNT(*) as cantidad
FROM group_members;

-- PASO 2: Crear función para asignación automática
CREATE OR REPLACE FUNCTION fn_asignar_estudiantes_faltantes()
RETURNS TABLE (estudiante_id UUID, estudiante_nombre TEXT, grupo_id UUID, grupo_nombre TEXT, estado TEXT) AS $$
DECLARE
    r RECORD;
    grupo_predeterminado UUID;
BEGIN
    FOR r IN 
        SELECT id, full_name, organization_id 
        FROM profiles 
        WHERE role = 'student'
          AND id NOT IN (SELECT profile_id FROM group_members)
          AND id NOT IN (SELECT student_id FROM enrollments)
    LOOP
        SELECT id INTO grupo_predeterminado
        FROM groups
        WHERE organization_id = r.organization_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF grupo_predeterminado IS NULL THEN
            INSERT INTO groups (name, organization_id, description, created_at)
            VALUES (
                'Grupo General',
                r.organization_id,
                'Grupo predeterminado creado automáticamente',
                NOW()
            )
            RETURNING id INTO grupo_predeterminado;
        END IF;

        INSERT INTO group_members (group_id, profile_id, role)
        VALUES (grupo_predeterminado, r.id, 'student')
        ON CONFLICT (group_id, profile_id) DO NOTHING;

        estudiante_id := r.id;
        estudiante_nombre := r.full_name;
        grupo_id := grupo_predeterminado;
        SELECT name INTO grupo_nombre FROM groups WHERE id = grupo_predeterminado;
        estado := 'ASIGNADO';
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 3: Ejecutar la asignación
SELECT '=== EJECUTANDO ASIGNACIÓN ===' as status;

SELECT * FROM fn_asignar_estudiantes_faltantes();

-- PASO 4: Verificar resultados
SELECT '=== RESULTADOS DESPUÉS DE ASIGNACIÓN ===' as status;

SELECT 
  'Estudiantes asignados' as categoria,
  COUNT(DISTINCT profile_id) as cantidad
FROM group_members
UNION ALL
SELECT 
  'Estudiantes sin grupo' as categoria,
  COUNT(*) as cantidad
FROM profiles 
WHERE role = 'student'
  AND id NOT IN (SELECT profile_id FROM group_members)
  AND id NOT IN (SELECT student_id FROM enrollments)
UNION ALL
SELECT 
  'Total membresías' as categoria,
  COUNT(*) as cantidad
FROM group_members;

-- PASO 5: Ver asignaciones detalladas
SELECT '=== ASIGNACIONES DETALLADAS ===' as status;

SELECT 
  p.name as estudiante,
  p.email,
  g.name as grupo,
  g.organization_id,
  gm.created_at
FROM group_members gm
JOIN profiles p ON p.id = gm.profile_id
JOIN groups g ON g.id = gm.group_id
WHERE p.role = 'student'
ORDER BY g.name, p.name;

-- PASO 6: Ver si Verónica está asignada
SELECT '=== VERIFICACIÓN: VERÓNICA MUÑOZ ===' as status;

SELECT 
  p.id as estudiante_id,
  p.name,
  p.email,
  g.id as grupo_id,
  g.name as grupo_nombre,
  CASE 
    WHEN gm.profile_id IS NOT NULL THEN '✅ ASIGNADA A GRUPO (group_members)'
    WHEN e.student_id IS NOT NULL THEN '✅ ASIGNADA A GRUPO (enrollments)'
    ELSE '❌ NO ASIGNADA'
  END as estado
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id
LEFT JOIN enrollments e ON e.student_id = p.id AND e.group_id = gm.group_id
LEFT JOIN groups g ON g.id = COALESCE(gm.group_id, e.group_id)
WHERE p.name ILIKE '%veronica%'
   OR p.email ILIKE '%veronica%';

SELECT '✅ ASIGNACIÓN COMPLETADA' as status;
