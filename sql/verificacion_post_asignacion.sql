-- ============================================
-- VERIFICACIÓN POST-ASIGNACIÓN
-- ============================================

-- Resumen general
SELECT 
  'TOTAL ESTUDIANTES' as categoria,
  COUNT(*)::text as valor
FROM profiles WHERE role = 'student'
UNION ALL
SELECT 
  'CON GRUPO (group_members)',
  COUNT(*)::text
FROM group_members WHERE role = 'student'
UNION ALL
SELECT 
  'SIN GRUPO',
  COUNT(*)::text
FROM profiles 
WHERE role = 'student'
  AND id NOT IN (SELECT profile_id FROM group_members)
  AND id NOT IN (SELECT student_id FROM enrollments);

-- Detalle por estudiante
SELECT 
  p.full_name as estudiante,
  COALESCE(g.name, 'SIN GRUPO') as grupo,
  COUNT(a.id) as tareas
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id
LEFT JOIN enrollments e ON e.student_id = p.id
LEFT JOIN groups g ON g.id = COALESCE(gm.group_id, e.group_id)
LEFT JOIN assignments a ON a.group_id = g.id
WHERE p.role = 'student'
GROUP BY p.id, p.full_name, p.email, g.name
ORDER BY g.name NULLS LAST, p.full_name;

-- Ver específicamente a Verónica
SELECT 
  p.id as estudiante_id,
  p.full_name as estudiante,
  p.email,
  CASE 
    WHEN gm.profile_id IS NOT NULL THEN 'ASIGNADA A GRUPO'
    WHEN e.student_id IS NOT NULL THEN 'ASIGNADA A GRUPO (legacy)'
    ELSE 'NO ASIGNADA'
  END as estado,
  g.name as grupo_nombre,
  g.id as grupo_id,
  COUNT(a.id) as tareas_disponibles
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id
LEFT JOIN enrollments e ON e.student_id = p.id
LEFT JOIN groups g ON g.id = COALESCE(gm.group_id, e.group_id)
LEFT JOIN assignments a ON a.group_id = g.id
WHERE p.full_name ILIKE '%veronica%'
   OR p.email ILIKE '%veronica%'
GROUP BY p.id, p.full_name, p.email, gm.profile_id, e.student_id, g.name, g.id;

-- Tareas por grupo
SELECT 
  g.name as grupo,
  COUNT(DISTINCT gm.profile_id) as estudiantes,
  COUNT(a.id) as tareas
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.role = 'student'
LEFT JOIN assignments a ON a.group_id = g.id
GROUP BY g.id, g.name
ORDER BY g.name;

-- Tareas visibles (simulación RLS)
WITH estudiantes AS (
  SELECT id, full_name FROM profiles WHERE role = 'student'
),
grupos_estudiantes AS (
  SELECT 
    e.id as estudiante_id,
    COALESCE(gm.group_id, enr.group_id) as group_id
  FROM estudiantes e
  LEFT JOIN group_members gm ON gm.profile_id = e.id
  LEFT JOIN enrollments enr ON enr.student_id = e.id
)
SELECT 
  e.full_name as estudiante,
  COUNT(DISTINCT a.id) as tareas_visibles
FROM estudiantes e
LEFT JOIN grupos_estudiantes ge ON ge.estudiante_id = e.id
LEFT JOIN assignments a ON a.group_id = ge.group_id
GROUP BY e.id, e.full_name
ORDER BY tareas_visibles DESC, e.full_name;

-- 1. Resumen general
\echo '📊 RESUMEN GENERAL'
\echo '-------------------'
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE role = 'student')::text || ' estudiantes totales' as info
UNION ALL
SELECT 
  (SELECT COUNT(*) FROM group_members WHERE role = 'student')::text || ' estudiantes en grupos'
UNION ALL
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE role = 'student' AND id NOT IN (SELECT profile_id FROM group_members) AND id NOT IN (SELECT student_id FROM enrollments))::text || ' estudiantes sin grupo ❌';

\echo ''

-- 2. Verónica específicamente
\echo '👤 VERÓNICA MUÑOZ'
\echo '-------------------'
SELECT 
  p.id as estudiante_id,
  p.full_name as estudiante,
  p.email,
  CASE 
    WHEN gm.profile_id IS NOT NULL THEN '✅ ASIGNADA A GRUPO'
    WHEN e.student_id IS NOT NULL THEN '✅ ASIGNADA A GRUPO (legacy)'
    ELSE '❌ NO ASIGNADA'
  END as estado,
  g.name as grupo_nombre,
  g.id as grupo_id,
  COUNT(a.id) as tareas_disponibles
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id
LEFT JOIN enrollments e ON e.student_id = p.id
LEFT JOIN groups g ON g.id = COALESCE(gm.group_id, e.group_id)
LEFT JOIN assignments a ON a.group_id = g.id
WHERE p.full_name ILIKE '%veronica%'
   OR p.email ILIKE '%veronica%'
GROUP BY p.id, p.name, p.email, gm.profile_id, e.student_id, g.name, g.id;

\echo ''

-- 3. Todos los estudiantes
\echo '🎓 TODOS LOS ESTUDIANTES'
\echo '--------------------------'
SELECT 
  p.full_name as estudiante,
  p.email,
  COALESCE(g.name, '❌ SIN GRUPO') as grupo,
  CASE 
    WHEN g.name IS NOT NULL THEN '✅'
    ELSE '❌'
  END as ok,
  COUNT(a.id) as tareas
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id
LEFT JOIN enrollments e ON e.student_id = p.id
LEFT JOIN groups g ON g.id = COALESCE(gm.group_id, e.group_id)
LEFT JOIN assignments a ON a.group_id = g.id
WHERE p.role = 'student'
GROUP BY p.id, p.full_name, p.email, g.name
ORDER BY g.name NULLS LAST, p.full_name;

\echo ''

-- 4. Tareas por grupo
\echo '📚 TAREAS POR GRUPO'
\echo '--------------------'
SELECT 
  g.name as grupo,
  COUNT(DISTINCT gm.profile_id) as estudiantes,
  COUNT(a.id) as tareas
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.role = 'student'
LEFT JOIN assignments a ON a.group_id = g.id
GROUP BY g.id, g.name
ORDER BY g.name;

\echo ''

-- 5. Tareas visibles para estudiantes (simulación RLS)
\echo '🔍 SIMULACIÓN RLS (tareas visibles con RLS)'
\echo '-----------------------------------------------'
WITH estudiantes AS (
  SELECT id, name FROM profiles WHERE role = 'student'
),
grupos_estudiantes AS (
  SELECT 
    e.id as estudiante_id,
    COALESCE(gm.group_id, enr.group_id) as group_id
  FROM estudiantes e
  LEFT JOIN group_members gm ON gm.profile_id = e.id
  LEFT JOIN enrollments enr ON enr.student_id = e.id
)
SELECT 
  e.name as estudiante,
  COUNT(DISTINCT a.id) as tareas_visibles
FROM estudiantes e
LEFT JOIN grupos_estudiantes ge ON ge.estudiante_id = e.id
LEFT JOIN assignments a ON a.group_id = ge.group_id
GROUP BY e.id, e.name
ORDER BY tareas_visibles DESC, e.name;

\echo ''
\echo '========================================'
\echo '✅ VERIFICACIÓN COMPLETADA'
\echo '========================================'
\echo ''
\echo 'Si algún estudiante muestra "❌ SIN GRUPO":'
\echo '  Ejecutar: SELECT * FROM fn_asignar_estudiantes_faltantes();'
\echo ''
