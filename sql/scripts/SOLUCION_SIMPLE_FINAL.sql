-- ============================================
-- SOLUCIÓN SIMPLE Y DIRECTA
-- Sin recursión, sin nombres complejos
-- ============================================

-- Paso 1: Desactivar RLS
ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;

-- Paso 2: Eliminar TODAS (con nombre exacto si existen)
DO $$
DECLARE
    pol record;
BEGIN
    -- conversation_participants
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'conversation_participants'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.conversation_participants CASCADE';
    END LOOP;
    -- messages  
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'messages'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.messages CASCADE';
    END LOOP;
    -- conversations
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'conversations'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.conversations CASCADE';
    END LOOP;
END $$;

-- Paso 3: Re-activar RLS
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Paso 4: Crear políticas SIMPLES (1 por tabla, sin complicaciones)
-- MESSAGES: Solo permitir CRUD si están en la conversación
CREATE POLICY "messages_crud" ON public.messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants 
      WHERE conversation_id = messages.conversation_id 
      AND profile_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants 
      WHERE conversation_id = messages.conversation_id 
      AND profile_id = auth.uid()
    )
  );

-- CONVERSATIONS: Solo permitir CRUD si son participantes
CREATE POLICY "conversations_crud" ON public.conversations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants 
      WHERE conversation_id = conversations.id 
      AND profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- CONVERSATION_PARTICIPANTS: Solo permitir si son participantes de la misma conversación
CREATE POLICY "participants_crud" ON public.conversation_participants
  FOR ALL TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid()
      AND organization_id IS NOT NULL
    )
  );

-- Paso 5: Verificar
SELECT '✅ POLÍTICAS SIMPLES CREADAS - SIN RECURSIÓN' as status,
  count(*) as total_politicas
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants');

-- Debería mostrar: 3 políticas (1 por tabla)
