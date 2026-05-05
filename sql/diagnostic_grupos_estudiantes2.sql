-- 2. GRUPOS DISPONIBLES
SELECT 'GRUPOS DISPONIBLES' as tipo,
       g.id,
       g.name,
       g.organization_id,
       g.program_id,
       (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as miembros_actuales
FROM groups g
ORDER BY g.name;