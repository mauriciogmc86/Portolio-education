-- ============================================
-- RLS POLICIES FOR MESSAGES TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Ensure helper functions exist
-- ============================================

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT LOWER(role) FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- 2. Enable RLS on messages table
-- ============================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS POLICIES FOR MESSAGES TABLE
-- ============================================

-- Policy: Allow authenticated users to SELECT messages from conversations they participate in
DROP POLICY IF EXISTS "users_read_messages_in_conversations" ON public.messages;
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

-- Policy: Allow authenticated users to INSERT messages into conversations they participate in
DROP POLICY IF EXISTS "users_insert_messages_in_conversations" ON public.messages;
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

-- Policy: Allow users to UPDATE their own messages (soft delete or edit)
DROP POLICY IF EXISTS "users_update_own_messages" ON public.messages;
CREATE POLICY "users_update_own_messages"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Policy: Allow users to DELETE (soft delete) their own messages
DROP POLICY IF EXISTS "users_delete_own_messages" ON public.messages;
CREATE POLICY "users_delete_own_messages"
ON public.messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- ============================================
-- 4. RLS POLICIES FOR CONVERSATIONS TABLE
-- ============================================

-- Enable RLS on conversations table
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to SELECT conversations they participate in
DROP POLICY IF EXISTS "users_read_conversations" ON public.conversations;
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

-- Policy: Allow authenticated users to INSERT conversations (for direct messages)
DROP POLICY IF EXISTS "users_create_conversations" ON public.conversations;
CREATE POLICY "users_create_conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Policy: Allow authenticated users to UPDATE conversations they participate in
DROP POLICY IF EXISTS "users_update_conversations" ON public.conversations;
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

-- Policy: Allow authenticated users to DELETE conversations they participate in
DROP POLICY IF EXISTS "users_delete_conversations" ON public.conversations;
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

-- ============================================
-- 5. RLS POLICIES FOR CONVERSATION_PARTICIPANTS TABLE
-- ============================================

-- Enable RLS on conversation_participants table
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to SELECT participants of their conversations
DROP POLICY IF EXISTS "users_read_conversation_participants" ON public.conversation_participants;
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

-- Policy: Allow users to INSERT participants when creating conversations
DROP POLICY IF EXISTS "users_insert_conversation_participants" ON public.conversation_participants;
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

-- Policy: Allow users to UPDATE their own participant records
DROP POLICY IF EXISTS "users_update_conversation_participants" ON public.conversation_participants;
CREATE POLICY "users_update_conversation_participants"
ON public.conversation_participants FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Policy: Allow users to DELETE their own participant records
DROP POLICY IF EXISTS "users_delete_conversation_participants" ON public.conversation_participants;
CREATE POLICY "users_delete_conversation_participants"
ON public.conversation_participants FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'RLS policies created successfully for messages, conversations, and conversation_participants tables' as status;