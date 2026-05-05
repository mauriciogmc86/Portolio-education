-- Verificar si hay registros en group_members
SELECT 'TOTAL GROUP_MEMBERS' as check_type, COUNT(*) as total FROM group_members;

-- Ver registros específicos
SELECT gm.*, g.name as grupo_nombre, p.full_name as miembro_nombre
FROM group_members gm
JOIN groups g ON g.id = gm.group_id
JOIN profiles p ON p.id = gm.profile_id
ORDER BY g.name;