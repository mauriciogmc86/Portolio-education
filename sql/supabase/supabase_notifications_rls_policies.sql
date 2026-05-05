-- ============================================
-- RLS POLICIES FOR NOTIFICATIONS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Enable RLS on notifications table
-- ============================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Drop existing policies (if any)
-- ============================================

DROP POLICY IF EXISTS "users_read_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_insert_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_select_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_insert_as_sender" ON public.notifications;
DROP POLICY IF EXISTS "users_update_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_delete_notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_crud" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

-- ============================================
-- 3. RLS POLICIES FOR NOTIFICATIONS TABLE
-- ============================================

-- Policy: Allow users to SELECT their own notifications
CREATE POLICY "users_read_own_notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  recipient_id = auth.uid()
  OR sender_id = auth.uid()
);

-- Policy: Allow users to INSERT notifications (triggers will work)
-- Using SECURITY INVOKER (default), the trigger runs with user's permissions
CREATE POLICY "users_insert_own_notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  recipient_id = auth.uid()
  OR sender_id = auth.uid()
  OR organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Policy: Allow users to UPDATE their own notifications (mark as read)
CREATE POLICY "users_update_notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Policy: Allow users to DELETE their own notifications
CREATE POLICY "users_delete_notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (recipient_id = auth.uid());

-- ============================================
-- 4. Helper Function for Notifications (optional)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_notification_recipient(notification_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE id = notification_id
    AND recipient_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'RLS policies applied successfully for notifications table' as status;
