-- ============================================
-- FIX AGRESIVO: Eliminar y recrear TODO
-- ============================================

-- 1. ELIMINAR TODAS las políticas de participants (fuerza bruta)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'conversation_participants'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.conversation_participants';
    END LOOP;
END $$;

-- 2. ELIMINAR políticas de messages (por si acaso)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'messages'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.messages';
    END LOOP;
END $$;

-- 3. ELIMINAR políticas de conversations (por si acaso)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'conversations'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.conversations';
    END LOOP;
END $$;

-- 4. Verificar que se eliminaron
SELECT 'Políticas eliminadas:' as status;
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('messages', 'conversations', 'conversation_participants');

-- ============================================
-- 5. RECREAR TODO DESDE CERO
-- ============================================

-- RLS para MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_messages_in_conversations"
ON public.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = messages.conversation_id
    AND profile_id = auth.uid()
  )
);

CREATE POLICY "users_insert_messages_in_conversations"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = messages.conversation_id
    AND profile_id = auth.uid()
  )
);

CREATE POLICY "users_update_own_messages"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "users_delete_own_messages"
ON public.messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- RLS para CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conversations.id
    AND profile_id = auth.uid()
  )
);

CREATE POLICY "users_create_conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "users_update_conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conversations.id
    AND profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conversations.id
    AND profile_id = auth.uid()
  )
);

CREATE POLICY "users_delete_conversations"
ON public.conversations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conversations.id
    AND profile_id = auth.uid()
  )
);

-- RLS para CONVERSATION_PARTICIPANTS (SIN RECURSIÓN)
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Política corregida: usa conversations como tabla intermedia
CREATE POLICY "users_read_conversation_participants"
ON public.conversation_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_participants.conversation_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = c.id
      AND cp2.profile_id = auth.uid()
    )
  )
  OR profile_id = auth.uid()
);

CREATE POLICY "users_insert_conversation_participants"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND organization_id IS NOT NULL
  )
);

CREATE POLICY "users_update_conversation_participants"
ON public.conversation_participants FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "users_delete_conversation_participants"
ON public.conversation_participants FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

-- ============================================
-- VERIFICACIÓN
-- ============================================

SELECT '✅ TODO RECREADO - Chat funcionando' as status,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'messages') as policies_messages,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'conversations') as policies_conversations,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'conversation_participants') as policies_participants;
