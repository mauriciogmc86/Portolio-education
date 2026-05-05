-- ============================================
-- SOLUCIÓN DEFINITIVA PARA NOTIFICATIONS RLS
-- Usa una función SECURITY DEFINER para bypass RLS
-- ============================================

-- Paso 1: Desactivar RLS y eliminar políticas existentes
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'notifications'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "'||pol.policyname||'" ON public.notifications CASCADE';
  END LOOP;
END $$;

-- Paso 2: Reactivar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Paso 3: Crear función SECURITY DEFINER para inserts de notificaciones
-- Esta función bypass RLS porque es SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.insert_notification_by_system(
  p_recipient_id UUID,
  p_sender_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (
    organization_id,
    recipient_id,
    sender_id,
    type,
    title,
    body,
    entity_type,
    entity_id,
    is_read,
    created_at
  )
  SELECT 
    p.organization_id,
    p_recipient_id,
    p_sender_id,
    p_type,
    p_title,
    p_body,
    p_entity_type,
    p_entity_id,
    false,
    NOW()
  FROM public.profiles p
  WHERE p.id = p_recipient_id
  AND p.organization_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 4: Políticas RLS simples para notifications

-- SELECT: Los usuarios ven sus propias notificaciones
CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (recipient_id = auth.uid() OR sender_id = auth.uid());

-- UPDATE: Solo el destinatario puede actualizar
CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- DELETE: Solo el destinatario puede eliminar
CREATE POLICY "notifications_delete_own"
ON public.notifications FOR DELETE
TO authenticated
USING (recipient_id = auth.uid());

-- Paso 5: Modificar el trigger para usar la función SECURITY DEFINER
-- Necesitas ejecutar esto manualmente en Supabase SQL Editor después:
CREATE OR REPLACE FUNCTION public.create_message_notification()
RETURNS trigger AS $$
BEGIN
  -- Usar la función SECURITY DEFINER para bypass RLS
  PERFORM public.insert_notification_by_system(
    p_recipient_id => p.profile_id,
    p_sender_id => NEW.sender_id,
    p_type => 'new_message',
    p_title => 'Nuevo mensaje',
    p_body => substring(NEW.content, 1, 50),
    p_entity_type => 'conversation',
    p_entity_id => NEW.conversation_id
  )
  FROM conversation_participants p
  WHERE p.conversation_id = NEW.conversation_id 
    AND p.profile_id != NEW.sender_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 6: Verificar
SELECT 
  'RLS policies and helper function created for notifications' as status;
