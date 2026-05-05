-- ============================================
-- SOLUCIÓN PARA ERROR DE NOTIFICATIONS RLS
-- Problema: Al enviar mensaje, trigger crea notificación
-- y viola la política RLS de la tabla notifications
-- ============================================

-- Paso 1: Desactivar RLS temporalmente
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Paso 2: Eliminar TODAS las políticas existentes de notifications
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'notifications'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "'||pol.policyname||'" ON public.notifications CASCADE';
  END LOOP;
END $$;

-- Paso 3: Reactivar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Paso 4: Crear políticas permisivas pero seguras
-- Estructura: id, organization_id, recipient_id, sender_id, type, title, body, entity_type, entity_id, action_url, image_url, is_read, read_at, created_at

-- SELECT: Los usuarios pueden ver notificaciones donde son recipient o sender
CREATE POLICY "users_select_own_notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  recipient_id = auth.uid()
  OR sender_id = auth.uid()
);

-- INSERT: Permitir inserción cuando el usuario es sender (quien genera la notificación)
-- Los triggers se ejecutan con el contexto del remitente
CREATE POLICY "users_insert_as_sender"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  OR recipient_id = auth.uid()
);

-- UPDATE: Solo el recipient puede modificar su notificación (ej. marcar como leída)
CREATE POLICY "users_update_own_notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- DELETE: Solo el recipient puede eliminar su notificación
CREATE POLICY "users_delete_own_notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (recipient_id = auth.uid());

-- Paso 5: Verificar políticas creadas
SELECT 
  policyname as policy_name,
  cmd as command,
  qual as using_condition,
  with_check as check_condition
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;
