-- ============================================
-- SINCRONIZAR ENROLLMENTS CON GROUP_MEMBERS
-- ============================================
-- Mantiene consistencia entre ambas tablas
-- ============================================

-- PASO 1: Insertar en enrollments lo que existe en group_members (para estudiantes)
INSERT INTO enrollments (student_id, group_id, enrolled_at)
SELECT 
    gm.profile_id as student_id,
    gm.group_id,
    gm.created_at as enrolled_at
FROM group_members gm
JOIN profiles p ON p.id = gm.profile_id
WHERE gm.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM enrollments e 
    WHERE e.student_id = gm.profile_id 
    AND e.group_id = gm.group_id
  );

SELECT 'Sincronización completada: ' || COUNT(*) || ' inscripciones creadas' as resultado
FROM enrollments e
WHERE e.enrolled_at >= NOW() - INTERVAL '1 minute';

-- PASO 2: Verificar consistencia
SELECT 
  'CONSISTENCIA' as tipo,
  'group_members (estudiantes)' as origen,
  COUNT(*) as cantidad
FROM group_members gm
JOIN profiles p ON p.id = gm.profile_id
WHERE gm.role = 'student'
UNION ALL
SELECT 
  'CONSISTENCIA' as tipo,
  'enrollments' as origen,
  COUNT(*) as cantidad
FROM enrollments;

SELECT '✅ SINCRONIZACIÓN COMPLETADA' as status;
