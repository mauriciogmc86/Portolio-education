-- ============================================
-- DESHABILITAR RLS TEMPORALMENTE
-- Para probar si el chat funciona sin RLS
-- ============================================

ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;

SELECT 'RLS DESHABILITADO' as status;
SELECT 'Prueba el chat ahora - si funciona, el problema NO es la recursión' as info;

-- ============================================
-- PARA VOLVER A HABILITAR (cuando quieras)
-- ============================================

-- ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- SELECT 'RLS HABILITADO' as status;
