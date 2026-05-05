-- ============================================
-- LISTAR ESTUDIANTES Y GRUPOS DISPONIBLES
-- Ejecutar cada sección por separado
-- ============================================

-- 1. TODOS LOS ESTUDIANTES
SELECT 'TODOS LOS ESTUDIANTES' as tipo, 
       COUNT(*) as total
FROM profiles p
WHERE p.role = 'student';

-- 2. ESTUDIANTES EN GROUP_MEMBERS (cualquier rol)
SELECT 'ESTUDIANTES EN GROUP_MEMBERS' as tipo,
       COUNT(*) as total
FROM group_members gm
JOIN profiles p ON p.id = gm.profile_id
WHERE p.role = 'student';

-- 3. ESTUDIANTES SIN GRUPO (sin group_members ni enrollments)
SELECT 'ESTUDIANTES SIN GRUPO' as tipo, 
       p.id, 
       p.email, 
       p.full_name,
       p.organization_id
FROM profiles p
WHERE p.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.profile_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = p.id)
ORDER BY p.email;

-- 4. DETALLE POR GRUPO
SELECT 'DETALLE POR GRUPO' as tipo,
       g.name as grupo,
       COUNT(gm.id) as miembros_en_group_members
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
GROUP BY g.id, g.name
ORDER BY g.name;
