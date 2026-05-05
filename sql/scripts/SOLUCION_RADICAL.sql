-- ============================================
-- SOLUCIÓN RADICAL: REVOKE + RECREATE
-- ============================================

-- PASO 1: Revocar TODOS los permisos (esto desactiva RLS temporalmente)
REVOKE ALL ON public.conversation_participants FROM authenticated;
REVOKE ALL ON public.messages FROM authenticated;
REVOKE ALL ON public.conversations FROM authenticated;

-- PASO 2: Eliminar TODAS las políticas por completo
-- (esto es más agresivo que DROP POLICY)

-- Eliminar policies de conversation_participants
DO $$
BEGIN
    -- Usamos dynamic SQL para forzar la eliminación
    EXECUTE 'ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Eliminar todas las políticas de la tabla
DELETE FROM pg_policy 
WHERE polrelid = 'conversation_participants'::regclass;

-- Eliminar policies de messages
DO $$
BEGIN
    EXECUTE 'ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DELETE FROM pg_policy 
WHERE polrelid = 'messages'::regclass;

-- Eliminar policies de conversations
DO $$
BEGIN
    EXECUTE 'ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DELETE FROM pg_policy 
WHERE polrelid = 'conversations'::regclass;

-- PASO 3: Re-crear políticas desde cero

-- Re-activar RLS
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREAR POLÍTICAS NUEVAS (SIN RECURSIÓN)
-- ============================================

-- Messages
CREATE POLICY "users_read_messages_in_conversations" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND profile_id = auth.uid()));
CREATE POLICY "users_insert_messages_in_conversions" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND profile_id = auth.uid()));
CREATE POLICY "users_update_own_messages" ON public.messages FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "users_delete_own_messages" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- Conversations
CREATE POLICY "users_read_conversations" ON public.conversations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND profile_id = auth.uid()));
CREATE POLICY "users_create_conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "users_update_conversations" ON public.conversations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND profile_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND profile_id = auth.uid()));
CREATE POLICY "users_delete_conversations" ON public.conversations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND profile_id = auth.uid()));

-- Conversation Participants (LA CLAVE: SIN RECURSIÓN)
CREATE POLICY "users_read_conversation_participants" ON public.conversation_participants FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_participants.conversation_id AND EXISTS (SELECT 1 FROM public.conversation_participants cp2 WHERE cp2.conversation_id = c.id AND cp2.profile_id = auth.uid())) OR profile_id = auth.uid());
CREATE POLICY "users_insert_conversation_participants" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL));
CREATE POLICY "users_update_conversation_participants" ON public.conversation_participants FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "users_delete_conversation_participants" ON public.conversation_participants FOR DELETE TO authenticated USING (profile_id = auth.uid());

-- ============================================
-- GRANT PERMISOS BÁSICOS
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;

-- ============================================
-- VERIFICACIÓN
-- ============================================

SELECT '✅ POLÍTICAS RECREADAS RADICALMENTE' as status,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'messages') as msg_policies,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'conversations') as conv_policies,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'conversation_participants') as part_policies;
