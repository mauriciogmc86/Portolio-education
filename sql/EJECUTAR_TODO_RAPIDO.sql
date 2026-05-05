-- ============================================
-- SCRIPT CORREGIDO: Solo crea enrollments para
-- estudiantes YA asignados a grupos por prof.
-- ============================================

-- PASO 0: Limpiar enrollments incorrectos
DELETE FROM enrollments
WHERE student_id IN (SELECT id FROM profiles WHERE role = 'student')
  AND group_id NOT IN (
    SELECT group_id FROM group_members 
    WHERE profile_id = enrollments.student_id
);

SELECT '✅ Enrollments incorrectos borrados' as status;

-- PASO 1: Crear enrollments para estudiantes que YA están en group_members
INSERT INTO enrollments (student_id, group_id, organization_id)
SELECT 
    gm.profile_id as student_id,
    gm.group_id,
    g.organization_id
FROM group_members gm
JOIN groups g ON g.id = gm.group_id
WHERE gm.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM enrollments e 
    WHERE e.student_id = gm.profile_id 
    AND e.group_id = gm.group_id
  )
ON CONFLICT DO NOTHING;

SELECT '✅ Enrollments creados para estudiantes en grupos' as status;

-- PASO 2: Verificar estado
SELECT 
  'RESUMEN' as tipo,
  COUNT(DISTINCT p.id) as total_estudiantes,
  COUNT(DISTINCT gm.profile_id) as en_grupos,
  COUNT(DISTINCT e.student_id) as con_enrollment
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id AND gm.role = 'student'
LEFT JOIN enrollments e ON e.student_id = p.id
WHERE p.role = 'student';

-- Detalle por estudiante
SELECT 
  p.full_name as estudiante,
  COALESCE(g.name, '❌ SIN GRUPO') as grupo,
  COALESCE(pr.name, '⚠️ SIN PROGRAMA') as programa,
  COUNT(DISTINCT a.id) as tareas,
  CASE 
    WHEN gm.profile_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as en_grupo
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id AND gm.role = 'student'
LEFT JOIN groups g ON g.id = gm.group_id
LEFT JOIN programs pr ON pr.id = g.program_id
LEFT JOIN assignments a ON a.group_id = g.id
WHERE p.role = 'student'
GROUP BY p.id, p.full_name, p.email, g.name, pr.name, gm.profile_id
ORDER BY p.full_name;

SELECT '✅ Script completado correctamente' as status;
