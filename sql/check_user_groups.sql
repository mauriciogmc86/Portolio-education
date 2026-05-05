-- Verificar el usuario actual y sus grupos
-- Primero: ver cuántos miembros hay en total
SELECT 'TOTAL MEMBERSHIPS' as tipo, COUNT(*)::text as cantidad FROM group_members;

-- Ver los miembros con sus grupos y roles
SELECT 
  p.full_name as miembro,
  p.role as tipo_usuario,
  g.name as grupo,
  gm.role as rol_en_grupo
FROM group_members gm
JOIN profiles p ON p.id = gm.profile_id
JOIN groups g ON g.id = gm.group_id
ORDER BY g.name, p.full_name;