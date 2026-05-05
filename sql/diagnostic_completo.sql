-- ============================================
-- DIAGNÓSTICO COMPLETO: TAREAS DE ESTUDIANTES
-- ============================================
-- Este script verifica toda la configuración de RLS
-- y la visibilidad de tareas para estudiantes
-- ============================================

-- PASO 1: Verificar tablas y RLS
SELECT 
  '1. ESTADO RLS - Tablas clave' as seccion,
  tablename,
  rowsecurity as rls_habilitado,
  (select count(*) from pg_policies where tablename = p.tablename) as num_policies
FROM pg_tables p
WHERE tablename IN ('assignments', 'profiles', 'groups', 'group_members', 'enrollments')
  AND schemaname = 'public'
ORDER BY tablename;

-- PASO 2: Conteo general
SELECT 
  '2. CONTADORES GENERALES' as seccion,
  'Estudiantes' as tipo,
  COUNT(*)::text as valor
FROM profiles WHERE role = 'student'
UNION ALL
SELECT '2. CONTADORES GENERALES', 'Grupos', COUNT(*)::text FROM groups
UNION ALL
SELECT '2. CONTADORES GENERALES', 'Tareas', COUNT(*)::text FROM assignments
UNION ALL
SELECT '2. CONTADORES GENERALES', 'Miembros (group_members)', COUNT(*)::text FROM group_members
UNION ALL
SELECT '2. CONTADORES GENERALES', 'Inscripciones (enrollments)', COUNT(*)::text FROM enrollments;

-- PASO 3: Políticas RLS en assignments
SELECT 
  '3. POLÍTICAS RLS - ASSIGNMENTS' as seccion,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'assignments'
ORDER BY policyname;

-- PASO 4: Verificar primer estudiante
WITH primer_estudiante AS (
  SELECT id, organization_id 
  FROM profiles 
  WHERE role = 'student' 
  LIMIT 1
)
SELECT 
  '4. ESTUDIANTE DE PRUEBA' as seccion,
  pe.id as estudiante_id,
  pe.organization_id as org_id,
  COUNT(DISTINCT gm.group_id) as grupos_en_group_members,
  COUNT(DISTINCT e.group_id) as grupos_en_enrollments
FROM primer_estudiante pe
LEFT JOIN group_members gm ON gm.profile_id = pe.id
LEFT JOIN enrollments e ON e.student_id = pe.id
GROUP BY pe.id, pe.organization_id;

-- PASO 5: Tareas de los grupos del estudiante
WITH primer_estudiante AS (
  SELECT id as estudiante_id 
  FROM profiles 
  WHERE role = 'student' 
  LIMIT 1
),
grupos_estudiante AS (
  SELECT group_id
  FROM group_members
  WHERE profile_id = (SELECT estudiante_id FROM primer_estudiante)
  UNION
  SELECT group_id
  FROM enrollments
  WHERE student_id = (SELECT estudiante_id FROM primer_estudiante)
)
SELECT 
  '5. TAREAS DE GRUPOS DEL ESTUDIANTE' as seccion,
  a.id as tarea_id,
  a.title as titulo,
  a.group_id as grupo_id,
  g.name as nombre_grupo,
  a.created_at as fecha_creacion
FROM assignments a
JOIN grupos_estudiante ge ON a.group_id = ge.group_id
JOIN groups g ON g.id = a.group_id
ORDER BY a.created_at DESC;

-- PASO 6: Simulación de acceso
-- Comprobar si RLS está filtrando correctamente
WITH primer_estudiante AS (
  SELECT id as estudiante_id 
  FROM profiles 
  WHERE role = 'student' 
  LIMIT 1
),
grupos_estudiante AS (
  SELECT group_id
  FROM group_members
  WHERE profile_id = (SELECT estudiante_id FROM primer_estudiante)
  UNION
  SELECT group_id
  FROM enrollments
  WHERE student_id = (SELECT estudiante_id FROM primer_estudiante)
)
SELECT 
  '6. SIMULACIÓN RLS' as seccion,
  'Tareas en grupos del estudiante' as descripcion,
  COUNT(*)::text as valor
FROM assignments
WHERE group_id IN (SELECT group_id FROM grupos_estudiante)
UNION ALL
SELECT 
  '6. SIMULACIÓN RLS',
  'Tareas con group_id NULL',
  COUNT(*)::text
FROM assignments
WHERE group_id IS NULL;

-- PASO 7: Recomendaciones
SELECT 
  '7. RECOMENDACIONES' as seccion,
  CASE 
    WHEN (SELECT COUNT(*) FROM profiles WHERE role = 'student') = 0
      THEN '❌ No hay estudiantes creados'
    WHEN (SELECT COUNT(*) FROM groups) = 0
      THEN '❌ No hay grupos creados'
    WHEN (SELECT COUNT(*) FROM group_members) = 0 AND (SELECT COUNT(*) FROM enrollments) = 0
      THEN '❌ No hay membresías (group_members o enrollments)'
    WHEN (SELECT COUNT(*) FROM assignments) = 0
      THEN '❌ No hay tareas creadas'
    WHEN EXISTS (SELECT 1 FROM assignments WHERE group_id IS NULL)
      THEN '⚠️ Hay tareas sin group_id asignado'
    WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assignments' AND qual = 'true')
      THEN '⚠️ Hay políticas RLS con USING(true) - peligroso'
    WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'assignments' AND schemaname = 'public') = false
      THEN '❌ RLS no habilitado en assignments'
    ELSE '✅ Configuración RLS parece correcta'
  END as diagnostico
ORDER BY seccion;
