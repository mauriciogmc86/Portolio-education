-- ============================================
-- VERIFICATION TEST FOR RLS POLICIES
-- Run these queries to verify policies are working
-- ============================================

-- Test 1: Check if RLS is enabled on messages table
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'messages';
-- Expected: relrowsecurity should be TRUE

-- Test 2: Check if RLS is enabled on conversations table  
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'conversations';
-- Expected: relrowsecurity should be TRUE

-- Test 3: Check if RLS is enabled on conversation_participants table
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'conversation_participants';
-- Expected: relrowsecurity should be TRUE

-- Test 4: List all policies on messages table
SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY policyname;
-- Expected: 4 policies (select, insert, update, delete)

-- Test 5: List all policies on conversations table
SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'conversations'
ORDER BY policyname;
-- Expected: 4 policies (select, insert, update, delete)

-- Test 6: List all policies on conversation_participants table
SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'conversation_participants'
ORDER BY policyname;
-- Expected: 4 policies (select, insert, update, delete)

-- Test 7: Verify helper functions exist
SELECT proname, lanname 
FROM pg_proc p 
JOIN pg_language l ON p.prolang = l.oid 
WHERE proname IN ('get_user_org_id', 'get_user_role');
-- Expected: Both functions should exist

-- Test 8: Count total policies across all chat tables
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants')
GROUP BY tablename;
-- Expected: Each table should have 4 policies

-- ============================================
-- SIMPLE FUNCTIONALITY TEST
-- Create a test conversation and message as authenticated user
-- ============================================

/*
-- Run these as an authenticated user (after setting auth.uid() via service role key)

-- Create a test conversation
INSERT INTO conversations (id, type, organization_id)
VALUES ('test-conv-uuid', 'direct', 'test-org-uuid');

-- Add yourself as participant
INSERT INTO conversation_participants (conversation_id, profile_id, is_active)
VALUES ('test-conv-uuid', auth.uid(), true);

-- Try to insert a message (should succeed)
INSERT INTO messages (id, conversation_id, sender_id, content, message_type)
VALUES ('test-msg-uuid', 'test-conv-uuid', auth.uid(), 'Test message', 'text');

-- Try to read messages (should succeed)
SELECT * FROM messages WHERE conversation_id = 'test-conv-uuid';

-- Try to update your own message (should succeed)
UPDATE messages SET content = 'Updated message' WHERE id = 'test-msg-uuid';

-- Cleanup
DELETE FROM messages WHERE id = 'test-msg-uuid';
DELETE FROM conversation_participants WHERE conversation_id = 'test-conv-uuid';
DELETE FROM conversations WHERE id = 'test-conv-uuid';
*/
