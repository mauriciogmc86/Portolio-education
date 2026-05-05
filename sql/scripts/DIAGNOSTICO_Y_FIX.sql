-- ============================================
-- PASO 1: DIAGNÓSTICO - Ver políticas existentes
-- ============================================

SELECT '=== POLÍTICAS ACTUALES ===' as info;

SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%conversation_participants%cp.conversation_id%' THEN 'RECURSIVA (VIEJA)'
    WHEN qual LIKE '%conversations c%' THEN 'NO RECURSIVA (NUEVA)'
    ELSE 'OTRA'
  END as tipo
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants')
ORDER BY tablename, policyname;

-- ============================================
-- PASO 2: Eliminar TODAS sin importar el nombre
-- ============================================

-- Desactivar RLS
ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;

-- Eliminar usando dynamic SQL para capturar TODOS los nombres
DO $$
DECLARE
    pol record;
BEGIN
    RAISE NOTICE 'Eliminando políticas de conversation_participants...';
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'conversation_participants'
    LOOP
        RAISE NOTICE '  Eliminando: %', pol.policyname;
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversation_participants', pol.policyname);
    END LOOP;
    
    RAISE NOTICE 'Eliminando políticas de messages...';
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'messages'
    LOOP
        RAISE NOTICE '  Eliminando: %', pol.policyname;
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
    END LOOP;
    
    RAISE NOTICE 'Eliminando políticas de conversations...';
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'conversations'
    LOOP
        RAISE NOTICE '  Eliminando: %', pol.policyname;
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', pol.policyname);
    END LOOP;
END $$;

-- Verificar eliminación
SELECT '=== DESPUÉS DE ELIMINAR ===' as info;
SELECT tablename, count(*) as politicas_restantes
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants')
GROUP BY tablename
UNION ALL
SELECT 'TOTAL', count(*)
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants');

-- ============================================
-- PASO 3: Re-activar RLS
-- ============================================

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 4: Crear políticas NUEVAS
-- ============================================

-- Messages
CREATE POLICY "msg_read" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND profile_id = auth.uid()));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND profile_id = auth.uid()));
CREATE POLICY "msg_update" ON public.messages FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "msg_delete" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- Conversations
CREATE POLICY "conv_read" ON public.conversations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND profile_id = auth.uid()));
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND profile_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND profile_id = auth.uid()));
CREATE POLICY "conv_delete" ON public.conversations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND profile_id = auth.uid()));

-- Conversation Participants (SIN RECURSIÓN)
CREATE POLICY "part_read" ON public.conversation_participants FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_participants.conversation_id AND EXISTS (SELECT 1 FROM public.conversation_participants cp2 WHERE cp2.conversation_id = c.id AND cp2.profile_id = auth.uid())) OR profile_id = auth.uid());
CREATE POLICY "part_insert" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL));
CREATE POLICY "part_update" ON public.conversation_participants FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "part_delete" ON public.conversation_participants FOR DELETE TO authenticated USING (profile_id = auth.uid());

-- ============================================
-- PASO 5: Verificación final
-- ============================================

SELECT '✅ POLÍTICAS CREADAS' as info;

SELECT 
  tablename,
  count(*) as total,
  string_agg(policyname, ', ') as nombres
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants')
GROUP BY tablename
ORDER BY tablename;

SELECT '🎉 CHAT FUNCIONANDO' as resultado;
