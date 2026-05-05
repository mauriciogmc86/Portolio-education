-- ============================================
-- DIAGNÓSTICO: Ver políticas EXACTAS en la BD
-- ============================================

-- Mostrar todas las políticas actuales
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%conversation_participants%cp.conversation_id%' THEN '❌ RECURSIVA (VIEJA)'
    WHEN qual LIKE '%conversations c%' THEN '✅ NUEVA (sin recursión)'
    WHEN qual LIKE '%conversation_participants cp2%' THEN '✅ NUEVA (sin recursión)'
    ELSE '?'
  END as tipo
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants')
ORDER BY tablename, policyname;

-- Conteo por tabla
SELECT 
  'Total políticas:' as info,
  count(*) as cantidad
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants')
UNION ALL
SELECT 
  'Tabla: messages',
  count(*)
FROM pg_policies WHERE tablename = 'messages'
UNION ALL
SELECT 
  'Tabla: conversations',
  count(*)
FROM pg_policies WHERE tablename = 'conversations'
UNION ALL
SELECT 
  'Tabla: conversation_participants',
  count(*)
FROM pg_policies WHERE tablename = 'conversation_participants';
