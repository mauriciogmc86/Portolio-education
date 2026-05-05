-- Ver todos los usuarios que son teachers y sus grupos
SELECT 
  p.full_name as profesor,
  p.email,
  g.name as grupo_asignado,
  gm.role as rol_en_grupo
FROM group_members gm
JOIN profiles p ON p.id = gm.profile_id
JOIN groups g ON g.id = gm.group_id
WHERE p.role = 'teacher'
ORDER BY g.name;