# Chat Messaging RLS Policy Fix

## Problem
The chat messaging feature was failing with error:
```
POST https://vemongrxyptqclrinnyr.supabase.co/rest/v1/messages?select=* 403 (Forbidden)
{
  code: '42501',
  details: null,
  hint: null,
  message: 'new row violates row-level security policy for table "messages"'
}
```

## Root Cause
The `messages` table had Row-Level Security (RLS) enabled, but no INSERT policy was defined to allow authenticated users to insert messages into conversations they participate in.

## Solution
Applied comprehensive RLS policies for the chat-related tables:
- `messages`
- `conversations` 
- `conversation_participants`

## Applied Policies

### Messages Table
1. **SELECT**: Users can read messages from conversations they participate in
2. **INSERT**: Users can insert messages into conversations they participate in (only as their own user ID)
3. **UPDATE**: Users can update their own messages
4. **DELETE**: Users can delete their own messages

### Conversations Table
1. **SELECT**: Users can read conversations they participate in
2. **INSERT**: Users can create conversations (for direct messages)
3. **UPDATE**: Users can update conversations they participate in
4. **DELETE**: Users can delete conversations they participate in

### Conversation Participants Table
1. **SELECT**: Users can read participants of their conversations
2. **INSERT**: Users can insert participants when creating conversations
3. **UPDATE**: Users can update their own participant records
4. **DELETE**: Users can delete their own participant records

## Installation
Run the following SQL in your Supabase SQL Editor:

```sql
-- Run this file to apply RLS policies
\i supabase_messages_rls_policies.sql
```

Or copy-paste the contents into the Supabase SQL Editor and execute.

## Verification
After applying the policies, test the chat feature:
1. Start a new chat conversation
2. Send a message
3. Verify message appears in real-time
4. Verify other conversation participants can see the message

## Additional Notes
- The helper functions `get_user_org_id()` and `get_user_role()` should already exist in your database
- These policies assume the tables follow the standard schema used by the chat service
- RLS must be enabled on all three tables (the SQL script handles this)
- Policies are additive and won't conflict with existing RLS policies for other tables
