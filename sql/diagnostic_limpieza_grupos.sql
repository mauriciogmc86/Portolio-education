-- ============================================
-- DIAGNOSTICO Y LIMPIEZA DE MIEMBROS DE GRUPOS
-- ============================================

-- Ver todos los miembros por grupo
SELECT 
  g.name as grupo,
  p.full_name as miembro,
  gm.role as rol
FROM group_members gm
JOIN groups g ON g.id = gm.group_id
JOIN profiles p ON p.id = gm.profile_id
ORDER BY g.name, gm.role;

-- Ver cuántos miembros hay por grupo
SELECT 
  g.name as grupo,
  COUNT(*) as total_miembros
FROM group_members gm
RIGHT JOIN groups g ON g.id = gm.group_id
GROUP BY g.id, g.name
ORDER BY g.name;

-- Ver si hay enrollments duplicados
SELECT 
  e.group_id,
  g.name as grupo,
  COUNT(*) as total_enrollments
FROM enrollments e
JOIN groups g ON g.id = e.group_id
GROUP BY e.group_id, g.name
ORDER BY g.name;