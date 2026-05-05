-- ============================================
-- VERIFICAR TRIGGERS Y FUNCIONES
-- ============================================

-- Ver triggers en las tablas de chat
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('messages', 'conversations', 'conversation_participants')
ORDER BY event_object_table, trigger_name;

-- Ver funciones que podrían causar loops
SELECT 
  proname as nombre_funcion,
  prosrc as codigo
FROM pg_proc
WHERE proname IN ('get_user_org_id', 'get_user_role', 'is_group_teacher', 'is_group_member')
   OR proname LIKE '%conversation%'
   OR proname LIKE '%chat%';

-- Ver tablas con RLS habilitado
SELECT 
  relname as tabla,
  relrowsecurity as rls_habilitado,
  relforcerowsecurity as rls_forzado
FROM pg_class
WHERE relname IN ('messages', 'conversations', 'conversation_participants');
